'use client';

import { useRouter } from 'next/navigation';
import { Box, Button, Card, CardContent, Container, Link as MuiLink, Stack, Typography } from '@mui/material';
import { Explore as ExploreIcon } from '@mui/icons-material';
import { Header } from '@/components/Header';
import { useAuth } from '@/components/AuthProvider';
import { grayscalePalette as palette } from '@/styles/palette';

export default function NistSubmissionPage() {
  const router = useRouter();
  const {
    isConnected,
    privateKeyMode,
    loading,
    walletAddress,
    openLoginModal,
    handleDisconnect,
  } = useAuth();

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      <Header
        displayAddress={walletAddress ?? null}
        privateKeyMode={privateKeyMode}
        isConnected={isConnected}
        onConnect={openLoginModal}
        onDisconnect={handleDisconnect}
        disableConnect={loading}
      />
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 6 } }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="overline" sx={{ letterSpacing: '0.2em', color: 'text.secondary', fontWeight: 800 }}>
              NIST public comment submission · April 2026
            </Typography>
            <Typography variant="h3" sx={{ mt: 1, fontWeight: 900, lineHeight: 1.1 }}>
              AI Agent Identity & Authorization
            </Typography>
            <Typography variant="h6" sx={{ mt: 1.5, color: 'text.secondary', maxWidth: 980 }}>
              This page summarizes the framing used by AgenticTrust and its reference implementation. It’s designed to pair
              the principles with a concrete “gateway” into the live Agent Explorer.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<ExploreIcon />}
                onClick={() => router.push('/agents')}
                sx={{ fontWeight: 900, borderRadius: 3, textTransform: 'none' }}
              >
                Explore live agents
              </Button>
              <Button
                variant="outlined"
                size="large"
                component="a"
                href="/"
                sx={{ fontWeight: 900, borderRadius: 3, textTransform: 'none', borderColor: palette.borderStrong }}
              >
                Back to home
              </Button>
              <MuiLink
                href="https://agentictrust.io"
                target="_blank"
                rel="noreferrer"
                sx={{ alignSelf: { sm: 'center' }, fontWeight: 800 }}
              >
                Reference implementation →
              </MuiLink>
            </Stack>
          </Box>

          <Card variant="outlined" sx={{ borderRadius: 4, borderColor: palette.border, backgroundColor: 'background.paper' }}>
            <CardContent>
              <Typography variant="h4" fontWeight={900} gutterBottom id="problem-reframing">
                1) Problem reframing (critical)
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 980 }}>
                Traditional identity systems ask: <strong>“Who is the user?”</strong>
                <br />
                Agent ecosystems require answering: <strong>“Who or what is acting, under whose authority, in what context,
                and how is that action trusted and verified?”</strong>
              </Typography>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: 4, borderColor: palette.border, backgroundColor: 'background.paper' }}>
            <CardContent>
              <Typography variant="h4" fontWeight={900} gutterBottom id="agent-root">
                2) Agent must be the root concept
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 980 }}>
                Treating AI agents as an “extension” of users or applications won’t scale. The root identity concept should be
                an <strong>Agent</strong>, where humans, organizations, AI agents, and digital twins are all agents in one
                unified model.
              </Typography>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: 4, borderColor: palette.border, backgroundColor: 'background.paper' }}>
            <CardContent>
              <Typography variant="h4" fontWeight={900} gutterBottom id="identity-anchor">
                3) Identity requires an anchor
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 980 }}>
                Identity must preserve unique resolution within domains, but agent systems also require a persistent,
                portable identifier that anchors an agent across systems and contexts.
              </Typography>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: 4, borderColor: palette.border, backgroundColor: 'background.paper' }}>
            <CardContent>
              <Typography variant="h4" fontWeight={900} gutterBottom id="contextual-identity">
                4) Identity is contextual
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 980 }}>
                Identity is not a single global record. An anchored agent expresses context-specific facets (domains, roles,
                and relationships) without fragmenting accountability.
              </Typography>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: 4, borderColor: palette.border, backgroundColor: 'background.paper' }}>
            <CardContent>
              <Typography variant="h4" fontWeight={900} gutterBottom id="time-and-evidence">
                5) Identity must include time and evidence
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 980 }}>
                Trust can’t be derived from identity alone. It must be derived from observed behavior over time: relationships
                persist, actions occur, and evidence updates trust-bearing relationships.
              </Typography>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: 4, borderColor: palette.border, backgroundColor: 'background.paper' }}>
            <CardContent>
              <Typography variant="h4" fontWeight={900} gutterBottom id="relational-trust">
                6) Trust is relational, not intrinsic
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 980 }}>
                Trust is not a static property of an agent. It is a directional, context-specific, evidence-based
                relationship between agents.
              </Typography>
            </CardContent>
          </Card>

          <Card
            variant="outlined"
            sx={{
              borderRadius: 4,
              borderColor: palette.border,
              backgroundColor: palette.surfaceMuted,
            }}
          >
            <CardContent>
              <Typography variant="h4" fontWeight={900} gutterBottom id="agent-trust-graph">
                7) The Agent Trust Graph is required
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 980 }}>
                Agent ecosystems require a graph-based model where agents and relationships are first-class objects, with
                assertions, delegation, and history enabling trust evaluation in context.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, maxWidth: 980 }}>
                In AgenticTrust, this is surfaced through an on-chain trust graph (ERC-8004) plus a Knowledge Base that
                makes the resulting context queryable.
              </Typography>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}

