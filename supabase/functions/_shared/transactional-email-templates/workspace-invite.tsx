import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Athrios Tarefas'

interface WorkspaceInviteProps {
  inviterName?: string
  workspaceName?: string
  acceptUrl?: string
}

const WorkspaceInviteEmail = ({
  inviterName,
  workspaceName,
  acceptUrl,
}: WorkspaceInviteProps) => {
  const ws = workspaceName || 'um workspace'
  const inviter = inviterName || 'Alguém'
  const url = acceptUrl || '#'

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>
        {inviter} convidou você para o workspace {ws} no {SITE_NAME}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Você foi convidado(a)</Heading>
          <Text style={text}>
            <strong>{inviter}</strong> convidou você para participar do
            workspace <strong>{ws}</strong> no {SITE_NAME}.
          </Text>
          <Text style={text}>
            Clique no botão abaixo para aceitar o convite. Você precisará
            entrar (ou criar uma conta) com este endereço de e-mail.
          </Text>
          <Section style={buttonSection}>
            <Button href={url} style={button}>
              Aceitar convite
            </Button>
          </Section>
          <Text style={hint}>
            Se o botão não funcionar, copie e cole este endereço no navegador:
            <br />
            <span style={urlText}>{url}</span>
          </Text>
          <Text style={footer}>
            Se você não esperava este convite, pode ignorar este e-mail.
            <br />— Equipe {SITE_NAME}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: WorkspaceInviteEmail,
  subject: (data: Record<string, any>) =>
    `Convite para o workspace ${data?.workspaceName ?? ''}`.trim(),
  displayName: 'Convite de workspace',
  previewData: {
    inviterName: 'Maria Souza',
    workspaceName: 'Contabilidade Athrios',
    acceptUrl: 'https://athrios-tarefas.lovable.app/convite/exemplo-id',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}
const container = {
  padding: '32px 28px',
  maxWidth: '560px',
  margin: '0 auto',
}
const h1 = {
  fontSize: '24px',
  fontWeight: 700,
  color: '#2c3a23',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#3b3528',
  margin: '0 0 16px',
}
const buttonSection = {
  margin: '28px 0',
  textAlign: 'center' as const,
}
const button = {
  backgroundColor: '#3a5236',
  color: '#f5f0e6',
  padding: '12px 28px',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-block',
}
const hint = {
  fontSize: '12px',
  color: '#7a7060',
  lineHeight: '1.5',
  margin: '24px 0 0',
}
const urlText = {
  color: '#b08c3a',
  wordBreak: 'break-all' as const,
}
const footer = {
  fontSize: '12px',
  color: '#9a9082',
  margin: '32px 0 0',
}
