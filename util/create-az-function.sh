#!/usr/bin/env bash

# azure config
SUBSCRIPTION=""
LOCATION=""
RESOURCE_GROUP=""
STORAGE_ACCOUNT=""
FUNCTION_APP_NAME=""

# environment variables
GITHUB_WEBHOOK_SECRET=""
GITHUB_TOKEN=""
MENTION_USER=""

az login

# set subscription
az account set --subscription "${SUBSCRIPTION}"

# create resource group
az group create --name "${RESOURCE_GROUP}" --location "${LOCATION}"

# create storage account
az storage account create --name "${STORAGE_ACCOUNT}" --resource-group "${RESOURCE_GROUP}" --location "${LOCATION}" --sku Standard_LRS

# delay for storage account to be created (e.g. for DNS names to be updated)
sleep 10

# create function app
az functionapp create \
  --name "${FUNCTION_APP_NAME}" \
  --storage-account "${STORAGE_ACCOUNT}" \
  --resource-group "${RESOURCE_GROUP}" \
  --consumption-plan-location "${LOCATION}" \
  --runtime "node" \
  --os-type "Linux" \
  --functions-version "4" \
  --runtime-version "14"

# delay for function app to be created
sleep 45

# deploy function
func azure functionapp publish "${FUNCTION_APP_NAME}"

# set required environment variables
az functionapp config appsettings set \
  --name "${FUNCTION_APP_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --settings "GITHUB_WEBHOOK_SECRET=${GITHUB_WEBHOOK_SECRET}" "GITHUB_TOKEN=${GITHUB_TOKEN}" "MENTION_USER=${MENTION_USER}"