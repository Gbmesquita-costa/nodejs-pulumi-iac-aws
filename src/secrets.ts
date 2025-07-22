import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();

// GET SECRETS FROM CONFIG (automatically encrypted)
const databaseUrl = config.requireSecret("DATABASE_URL");
const resendSecretKey = config.requireSecret("RESEND_SECRET_KEY");

const rabbitmqDefaultUser = config.requireSecret("RABBITMQ_USER");
const rabbitmqDefaultPass = config.requireSecret("RABBITMQ_PASSWORD");

// **SECRETS MANAGER**: Database credentials - DELETE IMMEDIATELY
export const databaseSecret = new aws.secretsmanager.Secret("database-secret", {
  name: "yourApplication/database",
  description: "Database connection credentials for yourApplication",
  // DELETE IMMEDIATELY without recovery period
  forceOverwriteReplicaSecret: true,
  recoveryWindowInDays: 0,
  tags: {
    Environment: "production",
    Application: "yourApplication",
    ManagedBy: "Pulumi",
  },
});

export const databaseSecretVersion = new aws.secretsmanager.SecretVersion(
  "database-secret-version",
  {
    secretId: databaseSecret.id,
    secretString: pulumi.interpolate`{"DATABASE_URL":"${databaseUrl}"}`,
  }
);

export const emailSecret = new aws.secretsmanager.Secret("email-secret", {
  name: "yourApplication/email",
  description: "Email service secrets for yourApplication",
  forceOverwriteReplicaSecret: true,
  recoveryWindowInDays: 0,
  tags: {
    Environment: "production",
    Application: "yourApplication",
    ManagedBy: "Pulumi",
  },
});

export const emailSecretVersion = new aws.secretsmanager.SecretVersion(
  "email-secret-version",
  {
    secretId: emailSecret.id,
    secretString: resendSecretKey.apply((key) =>
      JSON.stringify({
        RESEND_SECRET_KEY: key,
      })
    ),
  }
);

export const rabbitmqSecret = new aws.secretsmanager.Secret("rabbitmq-secret", {
  name: "yourApplication/rabbitmq",
  description: "RabbitMQ credentials for yourApplication",
  forceOverwriteReplicaSecret: true,
  recoveryWindowInDays: 0,
  tags: {
    Environment: "production",
    Application: "yourApplication",
    ManagedBy: "Pulumi",
  },
});

export const rabbitmqSecretVersion = new aws.secretsmanager.SecretVersion(
  "rabbitmq-secret-version",
  {
    secretId: rabbitmqSecret.id,
    secretString: pulumi
      .all([rabbitmqDefaultUser, rabbitmqDefaultPass])
      .apply(([user, pass]) =>
        JSON.stringify({
          RABBITMQ_DEFAULT_USER: user,
          RABBITMQ_DEFAULT_PASS: pass,
        })
      ),
  }
);

// **IAM ROLE**: ECS Task with permissions to access secrets
export const taskRole = new aws.iam.Role("ecs-task-role", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: {
          Service: "ecs-tasks.amazonaws.com",
        },
        Action: "sts:AssumeRole",
      },
    ],
  }),
  tags: {
    Environment: "production",
    Application: "yourApplication",
    ManagedBy: "Pulumi",
  },
});

// **IAM POLICY**: Access to secrets
export const secretsPolicy = new aws.iam.Policy("secrets-access-policy", {
  description: "Policy to allow ECS tasks to access yourApplication secrets",
  policy: pulumi
    .all([databaseSecret.arn, emailSecret.arn, rabbitmqSecret.arn])
    .apply(([dbArn, authArn, emailArn]) =>
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: [
              "secretsmanager:GetSecretValue",
              "secretsmanager:DescribeSecret",
            ],
            Resource: [dbArn, authArn, emailArn],
          },
        ],
      })
    ),
  tags: {
    Environment: "production",
    Application: "yourApplication",
    ManagedBy: "Pulumi",
  },
});

// **IAM ATTACHMENTS**: Attach policies to role
export const taskRolePolicyAttachment = new aws.iam.RolePolicyAttachment(
  "task-role-secrets-policy",
  {
    role: taskRole.name,
    policyArn: secretsPolicy.arn,
  }
);

export const taskRoleExecutionPolicyAttachment =
  new aws.iam.RolePolicyAttachment("task-role-execution-policy", {
    role: taskRole.name,
    policyArn:
      "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
  });

// **EXPORTS**: Secrets ARNs for use in services
export const secretArns = {
  database: databaseSecret.arn,
  email: emailSecret.arn,
  rabbitmq: rabbitmqSecret.arn,
};

// **EXPORTS**: Config validation for debugging
export const configValidation = {
  databaseConfigured: databaseUrl.apply(() => "✅ Database URL configured"),
  emailConfigured: resendSecretKey.apply(() => "✅ Email service configured"),
  rabbitmqConfigured: rabbitmqDefaultUser.apply(() => "✅ RabbitMQ configured"),
};
