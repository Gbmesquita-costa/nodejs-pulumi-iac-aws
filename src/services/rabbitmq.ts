import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";

import { cluster } from "../cluster";
import { appLoadBalancer, networkLoadBalancer } from "../load-balancer";

import { taskRole, secretArns } from "../secrets";

// Target Group for RabbitMQ Admin Interface (container internal port 15672)
const rabbitMQAdminTargetGroup = appLoadBalancer.createTargetGroup(
  "rabbitmq-admin-target",
  {
    port: 15672,
    protocol: "HTTP",
    healthCheck: {
      path: "/",
      protocol: "HTTP",
      interval: 30,
      healthyThreshold: 2,
      unhealthyThreshold: 3,
      timeout: 10,
      matcher: "200",
    },
  },
);

// HTTP listener on port 15672 for debugging/fallback (optional)
export const rabbitMQAdminHttpListener = appLoadBalancer.createListener(
  "rabbitmq-admin-http-listener",
  {
    port: 15672,
    protocol: "HTTP",
    targetGroup: rabbitMQAdminTargetGroup,
  },
);

// Target Group for AMQP (RabbitMQ internal protocol)
const amqpTargetGroup = networkLoadBalancer.createTargetGroup("amqp-target", {
  protocol: "TCP",
  port: 5672,
  targetType: "ip",
  healthCheck: {
    protocol: "TCP",
    port: "5672",
    interval: 30,
    healthyThreshold: 2,
    unhealthyThreshold: 2,
  },
});

export const amqpListener = networkLoadBalancer.createListener(
  "amqp-listener",
  {
    port: 5672,
    protocol: "TCP",
    targetGroup: amqpTargetGroup,
  },
);

export const rabbitMQService = new awsx.classic.ecs.FargateService(
  "fargate-rabbitmq",
  {
    cluster,
    desiredCount: 1,
    waitForSteadyState: false,
    taskDefinitionArgs: {
      taskRole: taskRole,
      executionRole: taskRole,
      container: {
        image: "rabbitmq:3-management",
        cpu: 256,
        memory: 512,

        // 🔧 Mapped ports: AMQP listener + HTTP listener (for debugging)
        portMappings: [amqpListener, rabbitMQAdminHttpListener],

        // Secrets do RabbitMQ via AWS Secrets Manager
        secrets: [
          {
            name: "RABBITMQ_DEFAULT_USER",
            valueFrom: pulumi.interpolate`${secretArns.rabbitmq}:RABBITMQ_DEFAULT_USER::`,
          },
          {
            name: "RABBITMQ_DEFAULT_PASS",
            valueFrom: pulumi.interpolate`${secretArns.rabbitmq}:RABBITMQ_DEFAULT_PASS::`,
          },
        ],

        // Non-sensitive settings
        environment: [
          {
            name: "RABBITMQ_DEFAULT_VHOST",
            value: "/",
          },
        ],
      },
    },
  },
);

export { rabbitMQAdminTargetGroup };
