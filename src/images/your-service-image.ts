import * as pulumi from "@pulumi/pulumi";

import * as awsx from "@pulumi/awsx";
import * as aws from "@pulumi/aws";

import * as docker from "@pulumi/docker-build";

const yourServiceECRRepository = new awsx.ecr.Repository("your-service-ecr", {
  forceDelete: true,
});

const yourServiceECRToken = aws.ecr.getAuthorizationTokenOutput({
  registryId: yourServiceECRRepository.repository.registryId,
});

export const yourDockerImage = new docker.Image("your-service-image", {
  tags: [
    pulumi.interpolate`${yourServiceECRRepository.repository.repositoryUrl}:latest`,
  ],
  context: {
    location: "../../",
  },
  push: true, // Build true
  platforms: ["linux/amd64"],
  registries: [
    {
      address: yourServiceECRRepository.repository.repositoryUrl,
      username: yourServiceECRToken.userName,
      password: yourServiceECRToken.password,
    },
  ],
});
