import { useState, useCallback, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { useTranslation } from 'react-i18next';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { jobsApi } from '../api';
import type { JobSheet } from '../types';

// ── Default skeleton ──────────────────────────────────────────────────────────
const JOB_SKELETON = `# Job Sheet

## 1. Role Overview
> Brief description of the role and its purpose within the team.

## 2. Responsibilities
- **Responsibility 1** — _describe the key duty_
- **Responsibility 2** — _describe the key duty_
- **Responsibility 3** — _describe the key duty_

## 3. Required Profile
### 3.1 Essential Skills
- [ ] Skill / experience 1
- [ ] Skill / experience 2

### 3.2 Desirable Skills
- [ ] Nice-to-have 1
- [ ] Nice-to-have 2

## 4. Education & Experience
- **Education** — _e.g. Engineering degree or equivalent_
- **Experience** — _e.g. 3+ years in a similar role_

## 5. Working Conditions
- **Location** — _e.g. Paris (hybrid)_
- **Contract** — _e.g. Permanent, full-time_
- **Salary** — _e.g. competitive, depending on experience_

## 6. Application Process
- [ ] Send CV and cover letter to [contact]
- [ ] Technical assessment
- [ ] Interview with the team

## 7. Open Questions
- [ ] Question 1
- [ ] Question 2
`;

// ── Component ─────────────────────────────────────────────────────────────────
interface JobSheetContentProps {
  job: JobSheet;
  onUpdate: (updated: JobSheet) => void;
  isManager: boolean;
}

export default function JobSheetContent({ job, onUpdate, isManager }: JobSheetContentProps) {
  const { t } = useTranslation();

  const initial = job.content ?? JOB_SKELETON;

  const [mode,   setMode]   = useState<'preview' | 'edit'>('preview');
  const [draft,  setDraft]  = useState(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!saving) setDraft(job.content ?? JOB_SKELETON);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.content]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const updated = await jobsApi.update({
        ...job,
        requiredSkills: job.requiredSkills ?? [],
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
