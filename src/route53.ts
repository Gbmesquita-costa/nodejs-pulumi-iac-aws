import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

import { appLoadBalancer } from "./load-balancer";

const DOMAIN_NAME = "yourdomain";
const RABBITMQ_SUBDOMAIN = "rabbitmq";

const MAIL_SUBDOMAIN = "mail";

// ⚠️  IMPORTANT: The zone must exist in Route 53 AND have nameservers configured
export const zone = aws.route53.getZone({
  name: DOMAIN_NAME,
  privateZone: false, // Public zone
});

// **SSL Certificate** - Wildcard for all subdomains
const cert = new aws.acm.Certificate("app-certificate", {
  domainName: DOMAIN_NAME,
  subjectAlternativeNames: [`*.${DOMAIN_NAME}`],
  validationMethod: "DNS",

  tags: {
    Name: `${DOMAIN_NAME} SSL Certificate`,
    ManagedBy: "Pulumi",
  },
});

// **DNS validation records**
const validationOptions = cert.domainValidationOptions.apply(
  (options) => options
);

export const validationRecords = validationOptions.apply((options) =>
  options.map(
    (option, index) =>
      new aws.route53.Record(`cert-validation-${index}`, {
        zoneId: zone.then((z) => z.zoneId),
        name: option.resourceRecordName,
        type: option.resourceRecordType,
        records: [option.resourceRecordValue],
        ttl: 60,
        allowOverwrite: true,
      })
  )
);

// **Certificate validation**
const validatedCert = new aws.acm.CertificateValidation(
  "cert-validation",
  {
    certificateArn: cert.arn,
    validationRecordFqdns: validationRecords.apply((records) =>
      records.map((r) => r.fqdn)
    ),
  },
  {
    customTimeouts: {
      create: "10m",
    },
  }
);

// **DNS Records**

// 🚀 MAIN: yourdomain → Your Application (main application)
export const rootDnsRecord = new aws.route53.Record(
  "root-alias",
  {
    zoneId: zone.then((z) => z.zoneId),
    name: "", // Root domain
    type: "A",

    aliases: [
      {
        name: appLoadBalancer.loadBalancer.dnsName,
        zoneId: appLoadBalancer.loadBalancer.zoneId,
        evaluateTargetHealth: true,
      },
    ],

    allowOverwrite: true,
  },
  {
    dependsOn: [appLoadBalancer.loadBalancer],
  }
);

// 🐰 RabbitMQ Admin: rabbitmq.yourdomain.com
export const rabbitmqDnsRecord = new aws.route53.Record(
  "rabbitmq-alias",
  {
    zoneId: zone.then((z) => z.zoneId),
    name: RABBITMQ_SUBDOMAIN,
    type: "A",

    aliases: [
      {
        name: appLoadBalancer.loadBalancer.dnsName,
        zoneId: appLoadBalancer.loadBalancer.zoneId,
        evaluateTargetHealth: true,
      },
    ],

    allowOverwrite: true,
  },
  {
    dependsOn: [appLoadBalancer.loadBalancer],
  }
);

// 📧 Email: mail.yourdomain.com (to Resend)
export const mailDnsRecord = new aws.route53.Record(
  "mail-alias",
  {
    zoneId: zone.then((z) => z.zoneId),
    name: MAIL_SUBDOMAIN,
    type: "A",

    aliases: [
      {
        name: appLoadBalancer.loadBalancer.dnsName,
        zoneId: appLoadBalancer.loadBalancer.zoneId,
        evaluateTargetHealth: true,
      },
    ],

    allowOverwrite: true,
  },
  {
    dependsOn: [appLoadBalancer.loadBalancer],
  }
);

// 🌐 WWW redirect para root
export const wwwDnsRecord = new aws.route53.Record("www-alias", {
  zoneId: zone.then((z) => z.zoneId),
  name: "www",
  type: "CNAME",
  records: [DOMAIN_NAME],
  ttl: 60,
});

// 📧 ============================================
// 📧 DNS RECORDS FOR EMAIL (RESEND)
// 📧 ============================================

// 📧 MX Record - To noreply.mail.yourdomain.com
export const noreplyMxRecord = new aws.route53.Record("noreply-mx", {
  zoneId: zone.then((z) => z.zoneId),
  name: `noreply.${MAIL_SUBDOMAIN}`, // "noreply.mail"
  type: "MX",
  records: ["10 feedback-smtp.us-east-1.amazonses.com"],
  ttl: 300,
  allowOverwrite: true,
});

// 📧 SPF Record - To noreply.mail.yourdomain.com
export const noreplySpfRecord = new aws.route53.Record("noreply-spf", {
  zoneId: zone.then((z) => z.zoneId),
  name: `noreply.${MAIL_SUBDOMAIN}`, // "noreply.mail"
  type: "TXT",
  records: ["v=spf1 include:amazonses.com ~all"],
  ttl: 300,
  allowOverwrite: true,
});

// 📧 DKIM Record - To resend._domainkey.mail.yourdomain.com
export const resendDkimRecord = new aws.route53.Record("resend-dkim", {
  zoneId: zone.then((z) => z.zoneId),
  name: `resend._domainkey.${MAIL_SUBDOMAIN}`, // "resend._domainkey.mail"
  type: "TXT",
  records: [
    "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDcXsUVUrNQjHuhwrbVaivs3RP8P58SQzhA9I3UKp7pSR/U1BmyYwucOWjIL0KfX90GWQvsMQlPNyawzuoOh8m+1WhiAuDPAhTNQxyxLzVvp6ue2qVz7WGwlPZjTavfGbgD7EY/5oO8FZOwoeENPV7E8SqCdKDiys8LspfTZ6G17wIDAQAB",
  ],
  ttl: 300,
  allowOverwrite: true,
});

// 📧 DMARC Record - To _dmarc.mail.yourdomain.com
export const mailDmarcRecord = new aws.route53.Record("mail-dmarc", {
  zoneId: zone.then((z) => z.zoneId),
  name: `_dmarc.${MAIL_SUBDOMAIN}`, // "_dmarc.mail"
  type: "TXT",
  records: ["v=DMARC1; p=none;"],
  ttl: 300,
  allowOverwrite: true,
});

export const rootUrl = pulumi.interpolate`https://${DOMAIN_NAME}`; // 🚀 Main API URL
export const wwwUrl = pulumi.interpolate`https://www.${DOMAIN_NAME}`;

export const rabbitmqUrl = pulumi.interpolate`https://${RABBITMQ_SUBDOMAIN}.${DOMAIN_NAME}`;
export const mailUrl = pulumi.interpolate`https://${MAIL_SUBDOMAIN}.${DOMAIN_NAME}`;

// Export of validated certificate
export const validatedCertificate = validatedCert;

export const zoneInfo = {
  zoneId: zone.then((z) => z.zoneId),
  nameServers: zone.then((z) => z.nameServers),
  domain: DOMAIN_NAME,

  urls: {
    api: rootUrl, // 🚀 yourdomain.com (main application)
    root: rootUrl, // 🚀 yourdomain.com
    www: wwwUrl, // 🌐 www.yourdomain.com
    rabbitmq: rabbitmqUrl, // 🐰 rabbitmq.yourdomain.com
    mail: mailUrl, // 📧 mail.yourdomain.com
    directLB: pulumi.interpolate`https://${appLoadBalancer.loadBalancer.dnsName}`,
  },

  // 📧 Specific configuration for emails
  emailConfig: {
    domain: pulumi.interpolate`${MAIL_SUBDOMAIN}.${DOMAIN_NAME}`,
    fromEmail: pulumi.interpolate`noreply@${MAIL_SUBDOMAIN}.${DOMAIN_NAME}`,
    supportEmail: pulumi.interpolate`support@${MAIL_SUBDOMAIN}.${DOMAIN_NAME}`,
    notificationEmail: pulumi.interpolate`notifications@${MAIL_SUBDOMAIN}.${DOMAIN_NAME}`,
  },
  status: "✅ Estrutura: Root + Mail + RabbitMQ + Email DNS configurado",
};

// 📧 Export email records for validation
export const emailDnsRecords = {
  noreplyMx: noreplyMxRecord,
  noreplySpf: noreplySpfRecord,
  resendDkim: resendDkimRecord,
  mailDmarc: mailDmarcRecord,
  status: "✅ Registros DNS do Resend configurados (MX, SPF, DKIM, DMARC)",
};
