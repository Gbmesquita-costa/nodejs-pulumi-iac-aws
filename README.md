# 🚀 Pulumi AWS Infrastructure - Node.js TypeScript

Este projeto implementa uma infraestrutura completa na AWS usando **Pulumi** em TypeScript, configurando um ambiente de produção para aplicações Node.js com RabbitMQ, email (Resend), banco de dados e load balancers.

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Arquitetura](#-arquitetura)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Deploy](#-deploy)
- [Recursos Criados](#-recursos-criados)
- [Configuração da Aplicação](#-configuração-da-aplicação)
- [Variáveis de Ambiente](#-variáveis-de-ambiente)
- [Monitoramento](#-monitoramento)
- [Troubleshooting](#-troubleshooting)

## 🎯 Visão Geral

Esta infraestrutura automatiza o provisionamento de uma aplicação Node.js completa na AWS, incluindo:

- **ECS Fargate** para containers sem servidor
- **Application Load Balancer (ALB)** para distribuição de tráfego HTTPS
- **Network Load Balancer (NLB)** para protocolo AMQP do RabbitMQ
- **Route53** para gerenciamento de DNS
- **ACM** para certificados SSL automáticos
- **AWS Secrets Manager** para credenciais seguras
- **RabbitMQ** para mensageria
- **Auto Scaling** baseado em CPU
- **Integração com Resend** para emails transacionais

## 🏗️ Arquitetura

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Route53 DNS  │    │  ACM Certificate │    │  Secrets Manager│
│  yourdomain.com │    │   *.yourdomain   │    │   Credentials   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                Application Load Balancer (HTTPS)               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ yourdomain.com  │  │rabbitmq.domain  │  │ mail.domain.com │ │
│  │ (Your API)      │  │ (RabbitMQ Admin)│  │ (Resend DNS)    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ECS Fargate   │    │   ECS Fargate   │    │ Network Load    │
│  Your Service   │    │   RabbitMQ      │    │ Balancer (AMQP) │
│  (Port 3333)    │    │  (Port 15672)   │    │   (Port 5672)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📋 Pré-requisitos

### 1. Ferramentas Necessárias

```bash
# AWS CLI v2
aws --version

# Pulumi CLI
pulumi version

# Node.js 18+
node --version

# Yarn
yarn --version

# Docker (para build das imagens)
docker --version
```

### 2. Configuração da AWS

```bash
# Configure suas credenciais AWS
aws configure

# Verifique se está funcionando
aws sts get-caller-identity
```

### 3. Domínio Configurado

- Um domínio registrado (ex: `yourdomain.com`)
- Zona hospedada no Route53 (**CRÍTICO**: deve existir antes do deploy)

## 🛠️ Instalação

### 1. Clone o Repositório

```bash
git clone https://github.com/seu-usuario/nodejs-pulumi-iac-aws.git
cd nodejs-pulumi-iac-aws
```

### 2. Instale as Dependências

```bash
yarn install
```

### 3. Inicialize o Pulumi

```bash
# Login no Pulumi (pode usar --local para armazenamento local)
pulumi login

# Inicialize o stack
pulumi stack init prod
pulumi stack select prod
```

## ⚙️ Configuração

### 1. Configure as Variáveis do Pulumi

**⚠️ IMPORTANTE**: Substitua `yourdomain` pelo seu domínio real em todos os arquivos:

```bash
# Configuração das credenciais (serão criptografadas automaticamente)
pulumi config set --secret DATABASE_URL "postgresql://user:password@host:5432/database"
pulumi config set --secret RESEND_SECRET_KEY "re_xxxxxxxxxxxxxxxxx"
pulumi config set --secret RABBITMQ_USER "admin"
pulumi config set --secret RABBITMQ_PASSWORD "sua-senha-forte"
```

### 2. Ajuste o Domínio

Edite os arquivos e substitua `yourdomain` pelo seu domínio:

**`src/route53.ts`**:

```typescript
const DOMAIN_NAME = "seudominio.com"; // ⚠️ ALTERE AQUI
```

**`src/routing-rules.ts`**:

```typescript
hostHeader: {
  values: [
    "seudominio.com", // ⚠️ ALTERE AQUI
    "www.seudominio.com", // ⚠️ ALTERE AQUI
  ],
},
// ...
hostHeader: {
  values: ["rabbitmq.seudominio.com"], // ⚠️ ALTERE AQUI
},
```

### 3. Prepare sua Aplicação

Sua aplicação Node.js deve ter um `Dockerfile` na raiz:

```dockerfile
# Exemplo de Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3333

# Health check endpoint obrigatório
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3333/health || exit 1

CMD ["npm", "start"]
```

**Endpoint de Health Check obrigatório**:

```javascript
// Em sua aplicação Node.js
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});
```

## 🚀 Deploy

### 1. Preview das Mudanças

```bash
# Veja o que será criado antes de aplicar
pulumi preview
```

### 2. Deploy da Infraestrutura

```bash
# Deploy completo (pode demorar 10-15 minutos)
pulumi up

# Ou usando o script do package.json
yarn pulumi:up
```

### 3. Verificação Pós-Deploy

```bash
# Veja os outputs importantes
pulumi stack output

# Exemplo de outputs:
# apiUrl: https://seudominio.com
# rabbitMQAdminUrl: https://rabbitmq.seudominio.com
# domainConfiguration: {nameServers: [...]}
```

## 📦 Recursos Criados

### 🌐 Networking & DNS

- **Route53 Hosted Zone**: Gerenciamento de DNS
- **ACM Certificate**: Certificado SSL wildcard automático
- **DNS Records**: A, CNAME, MX, TXT para emails

### 🔒 Segurança

- **AWS Secrets Manager**: 3 secrets para database, email e RabbitMQ
- **IAM Roles**: Roles específicas para ECS com permissões mínimas
- **Security Groups**: Configurados automaticamente pelo ALB/NLB

### ⚖️ Load Balancers

- **Application Load Balancer**: Para tráfego HTTPS (porta 443)
- **Network Load Balancer**: Para protocolo AMQP (porta 5672)
- **Target Groups**: Health checks configurados

### 🐳 Containers

- **ECS Cluster**: Cluster Fargate para containers
- **ECS Services**:
  - Seu serviço principal (porta 3333)
  - RabbitMQ com interface admin (porta 15672)
- **Auto Scaling**: Baseado em CPU (1-5 instâncias)

### 🐰 Mensageria

- **RabbitMQ Container**: `rabbitmq:3-management`
- **Interface Admin**: Acessível via `https://rabbitmq.seudominio.com`
- **AMQP Endpoint**: Conecta internamente via NLB

### 📧 Email (Resend)

- **DNS Records**: MX, SPF, DKIM, DMARC pré-configurados
- **Domínio**: `mail.seudominio.com`
- **From Email**: `noreply@mail.seudominio.com`

## 🔧 Configuração da Aplicação

### Variáveis de Ambiente Disponíveis

Sua aplicação receberá automaticamente estas variáveis:

```bash
# Ambiente
NODE_ENV=production
PORT=3333
HOSTNAME=0.0.0.0

# Database (do Secrets Manager)
DATABASE_URL=postgresql://...

# Email (do Secrets Manager)
RESEND_SECRET_KEY=re_...
RESEND_FROM_EMAIL=noreply@mail.seudominio.com

# RabbitMQ (gerado automaticamente)
RABBITMQ_URL=amqp://user:pass@hostname:5672
```

### Conectando ao RabbitMQ

```javascript
// Exemplo em Node.js
const amqp = require("amqplib");

async function connectRabbitMQ() {
  const connection = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await connection.createChannel();
  return channel;
}
```

### Enviando Emails com Resend

```javascript
// Exemplo em Node.js
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_SECRET_KEY);

await resend.emails.send({
  from: process.env.RESEND_FROM_EMAIL,
  to: "usuario@exemplo.com",
  subject: "Bem-vindo!",
  html: "<p>Olá mundo!</p>",
});
```

## 📊 Monitoramento

### URLs de Acesso

Após o deploy, você terá acesso a:

- **API Principal**: `https://seudominio.com`
- **RabbitMQ Admin**: `https://rabbitmq.seudominio.com`
- **Health Check**: `https://seudominio.com/health`

### Logs dos Containers

```bash
# Via AWS CLI
aws logs describe-log-groups --log-group-name-prefix "/ecs/"

# Via Console AWS
# ECS > Clusters > app-cluster > Services > Tasks > Logs
```

### Métricas de Auto Scaling

O auto scaling está configurado para:

- **Métrica**: CPU média
- **Target**: 70%
- **Min**: 1 instância
- **Max**: 5 instâncias
- **Cooldown**: 5 minutos

## 🔧 Configuração do Resend

### 1. Adicione o Domínio no Resend

1. Acesse [resend.com/domains](https://resend.com/domains)
2. Adicione o domínio: `mail.seudominio.com`
3. **Não adicione DNS records manualmente** - eles já estão configurados via Pulumi!

### 2. Aguarde a Verificação

- A verificação pode demorar 5-10 minutos
- Status será atualizado automaticamente no dashboard Resend

## 🚨 Troubleshooting

### Problemas Comuns

#### 1. "Zone not found"

```bash
# Erro: Zona Route53 não existe
# Solução: Crie a zona manualmente primeiro
aws route53 create-hosted-zone --name seudominio.com --caller-reference $(date +%s)
```

#### 2. Health Check Failing

```bash
# Verifique se sua aplicação responde em /health
curl https://seudominio.com/health

# Logs do container
aws logs tail /ecs/app-cluster/your-service --follow
```

#### 3. RabbitMQ Connection Issues

```bash
# Teste a conectividade AMQP
telnet your-nlb-hostname 5672

# Verifique os logs do RabbitMQ
aws logs tail /ecs/app-cluster/rabbitmq --follow
```

#### 4. Email não Funcionando

```bash
# Verifique registros DNS
dig MX mail.seudominio.com
dig TXT mail.seudominio.com

# Status no Resend Dashboard
# Verificar se domínio está verificado
```

### Comandos Úteis

```bash
# Ver configuração atual
pulumi config

# Ver outputs
pulumi stack output

# Destruir tudo (CUIDADO!)
pulumi destroy

# Ver logs do Pulumi
pulumi logs --follow
```

### Limpeza de Recursos

```bash
# Para remover toda a infraestrutura
pulumi destroy

# Confirmação será solicitada
# Digite "yes" para confirmar
```

## 🛡️ Segurança

### Boas Práticas Implementadas

- ✅ **Secrets criptografados** no Pulumi e AWS Secrets Manager
- ✅ **HTTPS obrigatório** com certificados automáticos
- ✅ **IAM roles com permissões mínimas**
- ✅ **Security groups restritivos**
- ✅ **Health checks configurados**
- ✅ **Logs centralizados** no CloudWatch

### Recomendações Adicionais

- Configure **AWS WAF** para proteção adicional
- Implemente **backup automático** do banco de dados
- Configure **alertas CloudWatch** para métricas críticas
- Use **AWS Systems Manager** para acesso aos containers

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Commit: `git commit -m 'Adiciona nova funcionalidade'`
4. Push: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🆘 Suporte

Se encontrar problemas:

1. Verifique o [Troubleshooting](#-troubleshooting)
2. Abra uma [Issue](https://github.com/seu-usuario/nodejs-pulumi-iac-aws/issues)
3. Consulte a [documentação do Pulumi](https://www.pulumi.com/docs/)

---

⭐ **Se este projeto foi útil, deixe uma estrela!** ⭐
