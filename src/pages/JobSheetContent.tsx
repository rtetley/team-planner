import { useState, useCallback, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { useTranslation } from 'react-i18next';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { jobsApi } from '../api';
import type { JobSheet } from '../types';

// ── Default skeleton (mirrors jobs.inria.fr structure) ───────────────────────
const JOB_SKELETON = `## About the Research Centre / Department

> Briefly describe the Inria centre or department hosting this position and its scientific environment.

## Context

> Describe the research team, the project, and the broader scientific or industrial context.
> Mention any funding source, partners, or collaborations involved.

## Assignment

> Describe the main goal of the position: what the recruited person will work on and what they will contribute to.

## Main Activities

- _Activity 1_ — describe the specific task or deliverable
- _Activity 2_ — describe the specific task or deliverable
- _Activity 3_ — describe the specific task or deliverable
- Participate in team meetings, seminars, and scientific events
- Contribute to written reports and publications

## Skills

### Required
- _Degree_ — e.g. PhD or Engineering degree in Computer Science or equivalent
- _Experience_ — e.g. 2+ years in a relevant field
- _Technical skill_ — e.g. strong knowledge of X
- _Language_ — e.g. professional proficiency in English

### Desirable
- Experience with _tool / framework_
- Knowledge of _domain_
- _Other asset_

## General Information

| Field | Details |
|---|---|
| **Contract type** | _e.g. Fixed-term contract — 2 years_ |
| **Level of qualifications** | _e.g. PhD or equivalent_ |
| **Function** | _e.g. Research Engineer / Temporary Scientific Engineer_ |
| **Level of experience** | _e.g. From 3 to 5 years_ |
| **Location** | _e.g. Rennes / Paris / Sophia Antipolis_ |
| **Inria centre** | _e.g. Centre Inria de l'Université de Rennes_ |
| **Inria team** | _e.g. TEAM-NAME_ |
| **Starting date** | _e.g. 2025-09-01_ |
| **Deadline to apply** | _e.g. 2025-06-30_ |

## Benefits Package

- Subsidised meals
- Partial reimbursement of public transport costs
- 7 weeks of annual leave + 10 RTT days
- Possibility of teleworking (after 6 months) and flexible working hours
- Professional equipment (videoconferencing, computer loan, etc.)
- Access to vocational training
- Social, cultural and sports activities
- Full social security coverage

## Instructions to Apply

Please submit online: your **résumé**, a **cover letter**, and optionally **letters of recommendation**.

> ⚠️ Applications must be submitted through the Inria recruitment portal.
> Processing of applications sent by other channels is not guaranteed.

## Contacts

- **Inria team:** [TEAM-NAME](https://www.inria.fr/equipes/TEAM-NAME)
- **Recruiter:** Firstname Lastname — [firstname.lastname@inria.fr](mailto:firstname.lastname@inria.fr)
`;

// ── Component ─────────────────────────────────────────────────────────────────
interface JobSheetContentProps {
  job: JobSheet;
  onUpdate: (updated: JobSheet) => void;
  isManager: boolean;
}

export default function JobSheetContent({ job, onUpdate, isManager }: JobSheetContentProps) {
  const { t } = useTranslation();

  const initial = job.content || JOB_SKELETON;

  const [mode,   setMode]   = useState<'preview' | 'edit'>('preview');
  const [draft,  setDraft]  = useState(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!saving) setDraft(job.content || JOB_SKELETON);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.content]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const updated = await jobsApi.update({
        ...job,
        skillRatings: job.skillRatings ?? {},
        content: draft,
      });
      onUpdate(updated);
      setMode('preview');
    } finally {
      setSaving(false);
    }
  }, [job, draft, onUpdate]);

  const handleCancel = useCallback(() => {
    setDraft(job.content ?? JOB_SKELETON);
    setMode('preview');
  }, [job.content]);

  return (
    <Box>
      {/* toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, mb: 1.5 }}>
        {mode === 'preview' ? (
          isManager && (
            <Button size="small" priority="tertiary" iconId="fr-icon-edit-line" onClick={() => setMode('edit')}>
              {t('prd.edit')}
            </Button>
          )
        ) : (
          <>
            <Button size="small" priority="tertiary no outline" onClick={handleCancel} disabled={saving}>
              {t('prd.cancel')}
            </Button>
            <Button size="small" priority="primary" iconId="fr-icon-save-3-line" onClick={handleSave} disabled={saving}>
              {saving ? t('prd.saving') : t('prd.save')}
            </Button>
          </>
        )}
      </Box>

      {/* content */}
      {mode === 'edit' ? (
        <Box>
          <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: 'var(--text-mention-grey)' }}>
            {t('prd.editHint')}
          </Typography>
          <Box
            component="textarea"
            value={draft}
            onChange={e => setDraft((e.target as HTMLTextAreaElement).value)}
            spellCheck={false}
            sx={{
              width: '100%',
              minHeight: 480,
              resize: 'vertical',
              p: 1.5,
              fontFamily: 'ui-monospace, "Cascadia Code", "Source Code Pro", monospace',
              fontSize: '0.82rem',
              lineHeight: 1.6,
              bgcolor: 'var(--background-default-grey)',
              color: 'var(--text-default-grey)',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              outline: 'none',
              boxSizing: 'border-box',
              '&:focus': {
                borderColor: 'var(--border-action-high-blue-france)',
                boxShadow: '0 0 0 2px var(--border-action-high-blue-france)',
              },
            }}
          />
        </Box>
      ) : (
        <Box sx={{
          fontSize: '0.9rem',
          lineHeight: 1.7,
          '& h1': { fontSize: '1.4rem', mt: 0, mb: 1.5, pb: 0.5, borderBottom: '1px solid', borderColor: 'divider' },
          '& h2': { fontSize: '1.1rem', mt: 2.5, mb: 1, fontWeight: 700 },
          '& h3': { fontSize: '0.95rem', mt: 2, mb: 0.75, fontWeight: 600 },
          '& p':  { mt: 0, mb: 1 },
          '& ul, & ol': { pl: 2.5, mb: 1 },
          '& li': { mb: 0.25 },
          '& blockquote': {
            borderLeft: '3px solid', borderColor: 'var(--border-action-high-blue-france)',
            pl: 1.5, ml: 0, my: 1,
            color: 'var(--text-mention-grey)',
            fontStyle: 'italic',
          },
          '& table': { borderCollapse: 'collapse', width: '100%', mb: 1.5, fontSize: '0.85rem' },
          '& th, & td': { border: '1px solid', borderColor: 'divider', px: 1.25, py: 0.5 },
          '& th': { bgcolor: 'var(--background-raised-grey)', fontWeight: 600, textAlign: 'left' },
          '& code': {
            fontFamily: 'ui-monospace, monospace',
            fontSize: '0.82rem',
            bgcolor: 'var(--background-raised-grey)',
            px: 0.5, py: 0.15, borderRadius: 0.5,
          },
          '& pre': {
            bgcolor: 'var(--background-raised-grey)',
            p: 1.5, borderRadius: 1, mb: 1.5,
            overflow: 'auto',
            '& code': { bgcolor: 'transparent', p: 0 },
          },
          '& input[type="checkbox"]': { mr: 0.75 },
        }}>
          <MarkdownRenderer>{draft}</MarkdownRenderer>
        </Box>
      )}
    </Box>
  );
}
