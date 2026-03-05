import { useState, useCallback, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { projectsApi } from '../api';
import type { Project } from '../types';

// ── PRD skeleton ──────────────────────────────────────────────────────────────
const PRD_SKELETON = `# Product Requirement Document

## 1. Overview
> Brief description of the product / feature and its purpose.

## 2. Goals & Success Metrics
- **Goal 1** — _describe the desired outcome_
- **Goal 2** — _describe the desired outcome_

| Metric | Target |
|--------|--------|
| KPI 1  | value  |
| KPI 2  | value  |

## 3. Background & Context
> Why are we building this? What problem does it solve?

## 4. User Stories
- **As a** \`[role]\`, **I want to** \`[action]\` **so that** \`[benefit]\`.

## 5. Functional Requirements
### 5.1 Feature A
- [ ] Requirement 1
- [ ] Requirement 2

### 5.2 Feature B
- [ ] Requirement 1

## 6. Non-Functional Requirements
- **Performance** — _e.g. page load < 2 s_
- **Security** — _e.g. RBAC enforced_
- **Accessibility** — _e.g. WCAG 2.1 AA_

## 7. Out of Scope
- Item 1
- Item 2

## 8. Dependencies & Risks
| Item | Type | Mitigation |
|------|------|------------|
|      |      |            |

## 9. Timeline
| Milestone | Date |
|-----------|------|
|           |      |

## 10. Open Questions
- [ ] Question 1
- [ ] Question 2
`;

// ── Component ─────────────────────────────────────────────────────────────────
interface ProjectPrdProps {
  project: Project;
  onUpdate: (updated: Project) => void;
  isManager: boolean;
}

export default function ProjectPrd({ project, onUpdate, isManager }: ProjectPrdProps) {
  const { t } = useTranslation();

  const initial = project.prd ?? PRD_SKELETON;

  const [mode,    setMode]    = useState<'preview' | 'edit'>('preview');
  const [draft,   setDraft]   = useState(initial);
  const [saving,  setSaving]  = useState(false);

  // Keep local draft in sync if the project prop changes externally
  useEffect(() => {
    if (!saving) setDraft(project.prd ?? PRD_SKELETON);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.prd]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const updated = await projectsApi.update({
        ...project,
        requiredSkills: project.requiredSkills ?? [],
        workPackages:   project.workPackages   ?? [],
        prd: draft,
      });
      onUpdate(updated);
      setMode('preview');
    } finally {
      setSaving(false);
    }
  }, [project, draft, onUpdate]);

  const handleCancel = useCallback(() => {
    setDraft(project.prd ?? PRD_SKELETON);
    setMode('preview');
  }, [project.prd]);

  return (
    <Box>
      {/* ── toolbar ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, mb: 1.5 }}>
        {mode === 'preview' ? (
          isManager && (
            <Button
              size="small"
              priority="tertiary"
              iconId="fr-icon-edit-line"
              onClick={() => setMode('edit')}
            >
              {t('prd.edit')}
            </Button>
          )
        ) : (
          <>
            <Button
              size="small"
              priority="tertiary no outline"
              onClick={handleCancel}
              disabled={saving}
            >
              {t('prd.cancel')}
            </Button>
            <Button
              size="small"
              priority="primary"
              iconId="fr-icon-save-3-line"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? t('prd.saving') : t('prd.save')}
            </Button>
          </>
        )}
      </Box>

      {/* ── content ── */}
      {mode === 'edit' ? (
        <Box>
          <Typography
            variant="caption"
            sx={{ display: 'block', mb: 0.5, color: 'var(--text-mention-grey)' }}
          >
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
            px: 0.5, borderRadius: 0.5,
          },
          '& pre': {
            bgcolor: 'var(--background-raised-grey)',
            p: 1.5, borderRadius: 1, overflow: 'auto', mb: 1.5,
            '& code': { bgcolor: 'transparent', p: 0 },
          },
          '& input[type="checkbox"]': { mr: 0.75 },
        }}>
          <ReactMarkdown>{draft}</ReactMarkdown>
        </Box>
      )}
    </Box>
  );
}
