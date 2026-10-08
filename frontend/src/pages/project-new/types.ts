export interface BasicInfo {
  name: string
  description: string
  purpose: string
  type: string
}

export interface TechStack {
  frontend: string[]
  backend: string[]
  database: string[]
  services: string[]
  auth: string[]
  deployment: string[]
}

export interface Environments {
  development: string
  staging: string
  production: string
  browsers: string[]
  platforms: string[]
  os: string[]
}

export interface Architecture {
  style: string
  modules: string[]
  apiPatterns: string
}

export interface Rule {
  id?: string
  title: string
  description: string
}

export interface Quality {
  testingTools: string[]
  frameworks: string[]
  conventions: string
  constraints: string
  repoUrl: string
  docsUrl: string
}
