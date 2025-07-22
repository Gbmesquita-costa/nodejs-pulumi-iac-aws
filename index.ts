import * as pulumi from "@pulumi/pulumi";

import "./src/secrets";
import { secretArns } from "./src/secrets";

import { appLoadBalancer } from "./src/load-balancer";
import { rootUrl, rabbitmqUrl, mailUrl, zoneInfo } from "./src/route53";

import { yourServiceService } from "./src/services/your-service";
import { rabbitMQService } from "./src/services/rabbitmq";

import { routingConfiguration } from "./src/routing-rules";

export const yourServiceId = yourServiceService.service.id;
export const rabbitMQId = rabbitMQService.service.id;

export const apiUrl = rootUrl; // https://yourdomain.com (Main API)
export const applicationUrl = rootUrl; // https://yourdomain.com (compatibility)

export const rabbitMQAdminUrl = rabbitmqUrl; // https://rabbitmq.yourdomain.com
export const emailDomain = mailUrl; // https://mail.yourdomain.com (DNS only)

// **URLs for debugging/fallback**
export const rabbitMQDirectUrl = pulumi.interpolate`http://${appLoadBalancer.loadBalancer.dnsName}:15672`;

// **Domain setup information**
export const domainConfiguration = {
  domain: zoneInfo.domain,
  nameServers: zoneInfo.nameServers,
  zoneId: zoneInfo.zoneId,
  instructions: "Configure these nameservers to activate the domain",
};

// **Exports of secrets information**
export const secretsInfo = {
  databaseSecretArn: secretArns.database,
  emailSecretArn: secretArns.email,
  rabbitmqSecretArn: secretArns.rabbitmq,
};

// **🎯 Final structure summary**
export const urlsSummary = {
  mainAPI: rootUrl, // 🚀 yourdomain.com (apps make requests here)
  rabbitMQAdmin: rabbitmqUrl, // 🐰 rabbitmq.yourdomain.com
  emailDomain: mailUrl, // 📧 mail.yourdomain.com (Resend)
};

// **Routing information**
export const routingInfo = {
  configuration: routingConfiguration,
  httpsListenerPort: 443,
  structure:
    "yourdomain.com (API) + rabbitmq.yourdomain.com + mail.yourdomain.com",
  status: "✅ Roteamento baseado em Host Headers configurado",
};

// **📧 Specific configuration for emails (Resend)**
export const emailConfiguration = {
  domain: "mail.yourdomain.com",
  fromEmails: {
    noreply: "noreply@mail.yourdomain.com",
  },
  instructions: [
    "1. Add Domain 'mail.yourdomain.com' no Resend Dashboard",
    "2. Copiar DNS records fornecidos pelo Resend",
    "3. Adicionar records via Pulumi no Route53",
    "4. Aguardar verificação (5-10 minutos)",
    "5. Atualizar RESEND_FROM_EMAIL na aplicação",
  ],
  status: "📧 Pronto para configuração no Resend",
};
