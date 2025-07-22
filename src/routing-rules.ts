import * as aws from "@pulumi/aws";

import {
  yourServiceHttpsListener,
  yourServiceTargetGroup,
} from "./services/your-service";

import { rabbitMQAdminTargetGroup } from "./services/rabbitmq";

// Routing Rule for your API (Core API)
// Routes your domain and www.yourdomain to your app
export const yourAppListenerRule = new aws.lb.ListenerRule(
  "your-app-listener-rule",
  {
    listenerArn: yourServiceHttpsListener.listener.arn,
    priority: 100, // High priority
    actions: [
      {
        type: "forward",
        targetGroupArn: yourServiceTargetGroup.targetGroup.arn,
      },
    ],
    conditions: [
      {
        hostHeader: {
          values: [
            "your domain", // 🚀 Main Domain (API)
            "www.your domain", // 🌐 WWW redirect
          ],
        },
      },
    ],
  },
  {
    dependsOn: [yourServiceHttpsListener, yourServiceTargetGroup],
  }
);

// 🐰 Routing Rule for RabbitMQ Admin
// Route rabbitmq.your domain to RabbitMQ Admin Interface
export const rabbitMQListenerRule = new aws.lb.ListenerRule(
  "rabbitmq-listener-rule",
  {
    listenerArn: yourServiceHttpsListener.listener.arn,
    priority: 200, // Specific priority for RabbitMQ
    actions: [
      {
        type: "forward",
        targetGroupArn: rabbitMQAdminTargetGroup.targetGroup.arn,
      },
    ],
    conditions: [
      {
        hostHeader: {
          values: ["rabbitmq.your domain"], // 🐰 Specific subdomain
        },
      },
    ],
  },
  {
    dependsOn: [yourServiceHttpsListener, rabbitMQAdminTargetGroup],
  }
);

// 📧 NOTE: mail.your domain does NOT need ALB routing rule
// Because it will only be used for DNS of emails (Resend), not for web traffic

export const routingConfiguration = {
  yourAppRule: yourAppListenerRule,
  rabbitMQRule: rabbitMQListenerRule,
  summary: {
    mainAPI: "your domain → Your App",
    rabbitMQ: "rabbitmq.your domain → RabbitMQ Admin",
    email: "mail.your domain → DNS only (Resend)",
  },
  status: "✅ Roteamento HTTPS configurado",
};
