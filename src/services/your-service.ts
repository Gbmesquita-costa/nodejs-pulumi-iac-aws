import * as pulumi from "@pulumi/pulumi";

import * as awsx from "@pulumi/awsx";
import * as aws from "@pulumi/aws";

import { yourDockerImage } from "../images/your-service-image";
import { amqpListener } from "./rabbitmq";

import { cluster } from "../cluster";
import { appLoadBalancer } from "../load-balancer";

import { taskRole, secretArns } from "../secrets";
import { validatedCertificate } from "../route53";

// 🔐 Fetch RabbitMQ secret values
const rabbitmqSecretValue = aws.secretsmanager.getSecretVersionOutput({
  secretId: secretArns.rabbitmq,
});

// Parse JSON from secrets to extract user and password
const rabbitmqCredentials = rabbitmqSecretValue.secretString.apply(
  (secretString) => {
    const parsed = JSON.parse(secretString);
    return {
      user: parsed.RABBITMQ_DEFAULT_USER,
      password: parsed.RABBITMQ_DEFAULT_PASS,
    };
  }
);

// Target Group for Your App (container internal port 3333)
export const yourServiceTargetGroup = appLoadBalancer.createTargetGroup(
  "your-service-target",
  {
    port: 3333,
    protocol: "HTTP",
    healthCheck: {
      path: "/health",
      protocol: "HTTP",
      interval: 30,
      healthyThreshold: 2,
      unhealthyThreshold: 3,
      timeout: 10,
      matcher: "200",
    },
  }
);

// 🎯 Primary HTTPS Listener (port 443) - Default action for your-service
export const yourServiceHttpsListener = appLoadBalancer.createListener(
  "app-https-listener",
  {
    port: 443,
    targetGroup: yourServiceTargetGroup,
    protocol: "HTTPS",
    certificateArn: validatedCertificate.certificateArn,
    sslPolicy: "ELBSecurityPolicy-2016-08",
  },
  {
    // Wait for the certificate to be validated
    dependsOn: [validatedCertificate, yourServiceTargetGroup],
  }
);

export const yourServiceService = new awsx.classic.ecs.FargateService(
  "fargate-your-service",
  {
    cluster,
    desiredCount: 1,
    waitForSteadyState: false,
    taskDefinitionArgs: {
      // Use the role we created with permissions for secrets
      taskRole: taskRole,
      executionRole: taskRole,

      container: {
        image: yourDockerImage.ref,
        cpu: 256,
        memory: 512,
        portMappings: [yourServiceHttpsListener],

        // Non-sensitive environment variables (can be hardcoded)
        environment: [
          {
            name: "NODE_ENV",
            value: "production",
          },
          {
            name: "PORT",
            value: "3333",
          },
          {
            name: "HOSTNAME",
            value: "0.0.0.0",
          },
          {
            name: "RESEND_FROM_EMAIL",
            value: "noreply@mail.yourdomain.com",
          },
          {
            name: "RABBITMQ_URL",
            value: pulumi
              .all([
                rabbitmqCredentials,
                amqpListener.endpoint.hostname,
                amqpListener.endpoint.port,
              ])
              .apply(
                ([creds, hostname, port]) =>
                  `amqp://${creds.user}:${creds.password}@${hostname}:${port}`
              ),
          },
        ],

        // AWS Secrets Manager Secrets
        secrets: [
          // Database secrets
          {
            name: "DATABASE_URL",
            valueFrom: pulumi.interpolate`${secretArns.database}:DATABASE_URL::`,
          },
          // Email secrets
          {
            name: "RESEND_SECRET_KEY",
            valueFrom: pulumi.interpolate`${secretArns.email}:RESEND_SECRET_KEY::`,
          },
        ],
      },
    },
  }
);

// Auto Scaling Configuration
const scalingTarget = new aws.appautoscaling.Target(
  "your-service-autoscaling-target",
  {
    minCapacity: 1,
    maxCapacity: 5,
    serviceNamespace: "ecs",
    scalableDimension: "ecs:service:DesiredCount",
    resourceId: pulumi.interpolate`service/${cluster.cluster.name}/${yourServiceService.service.name}`,
  }
);

// Auto Scaling Policy by CPU
new aws.appautoscaling.Policy("your-service-autoscaling-policy-cpu", {
  serviceNamespace: scalingTarget.serviceNamespace,
  scalableDimension: scalingTarget.scalableDimension,
  resourceId: scalingTarget.resourceId,
  policyType: "TargetTrackingScaling",
  targetTrackingScalingPolicyConfiguration: {
    predefinedMetricSpecification: {
      predefinedMetricType: "ECSServiceAverageCPUUtilization",
    },
    targetValue: 70,
    scaleOutCooldown: 300,
    scaleInCooldown: 300,
  },
});
