import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { createModal, type ModalProps } from '@codegouvfr/react-dsfr/Modal';
import { useTranslation } from 'react-i18next';
import { projectsApi } from '../api';
import type { Project, WorkPackage } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────
const DAY_W    = 28;   // px per day
const ROW_H    = 44;   // WP row height
const HDR_H    = 26;   // height of each header sub-row (2 sub-rows total)
const LEFT_W   = 220;  // sticky title column width
const HANDLE_W = 8;    // drag handle width at each edge of a bar
const BAR_PAD  = 8;    // top/bottom margin inside a row
const BG       = 'var(--background-default-grey)';
const HDR_BG   = 'var(--background-raised-grey)';
const TODAY_COLOR = '#ef4444';
const WP_COLORS = [
  '#38bdf8', '#a78bfa', '#fb923c', '#4ade80', '#f472b6', '#facc15', '#34d399',
];

// ── Module-level DSFR modal ───────────────────────────────────────────────────
const wpModal = createModal({ isOpenedByDefault: false, id: 'roadmap-wp-form' });

// ── Date helpers ──────────────────────────────────────────────────────────────
/** Parse a YYYY-MM-DD string as a local date (avoids UTC timezone shifts). */
function toDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDays(s: string, n: number): string {
  const d = toDate(s);
  d.setDate(d.getDate() + n);
  return toIso(d);
}
function daysBetween(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000);
}

// ── Drag state ────────────────────────────────────────────────────────────────
type DragType = 'move' | 'resize-left' | 'resize-right';
interface DragState {
  wpId: string;
  type: DragType;
  originX: number;
  origStart: string;
  origEnd: string;
}

// ── Main component ────────────────────────────────────────────────────────────
interface ProjectRoadmapProps {
  project: Project;
  onUpdate: (updated: Project) => void;
  isManager: boolean;
}

export default function ProjectRoadmap({ project, onUpdate, isManager }: ProjectRoadmapProps) {
  const { t } = useTranslation();

  const [wps,              setWps]              = useState<WorkPackage[]>(project.workPackages ?? []);
  const [editingWp,        setEditingWp]        = useState<WorkPackage | null>(null);
  const [isDragging,       setIsDragging]       = useState(false);
  // form state (for the DSFR modal)
  const [formTitle,        setFormTitle]        = useState('');
  const [formStart,        setFormStart]        = useState('');
  const [formEnd,          setFormEnd]          = useState('');
  const [formColor,        setFormColor]        = useState(WP_COLORS[0]);
  const [formSubmitted,    setFormSubmitted]    = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const dragRef = useRef<DragState | null>(null);
  const wpsRef  = useRef(wps);
  useEffect(() => { wpsRef.current = wps; }, [wps]);

  // Sync from project prop (only when not dragging)
  useEffect(() => {
    if (!dragRef.current) setWps(project.workPackages ?? []);
  }, [project.workPackages]);

  // ── Modal helpers ──────────────────────────────────────────────────────
  const openCreate = useCallback(() => {
    const nextColor = WP_COLORS[wps.length % WP_COLORS.length];
    setEditingWp(null);
    setFormTitle('');
    setFormStart('');
    setFormEnd('');
    setFormColor(nextColor);
    setFormSubmitted(false);
    setShowDeleteConfirm(false);
    wpModal.open();
  }, [wps.length]);

  const openEdit = useCallback((wp: WorkPackage) => {
    setEditingWp(wp);
    setFormTitle(wp.title);
    setFormStart(wp.startDate);
    setFormEnd(wp.endDate);
    setFormColor(wp.color);
    setFormSubmitted(false);
    setShowDeleteConfirm(false);
    wpModal.open();
  }, []);

  // ── Date range ──────────────────────────────────────────────────────────
  const todayIso   = toIso(new Date());
  const rangeStart = project.startDate || todayIso;
  const rangeEnd   = project.endDate   || addDays(todayIso, 60);
  const totalDays  = Math.max(30, daysBetween(rangeStart, rangeEnd) + 1);

  // ── Month groups for header row 1 ────────────────────────────────────────
  const monthGroups = useMemo<{ label: string; days: number }[]>(() => {
    const groups: { label: string; days: number }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = toDate(addDays(rangeStart, i));
      const label = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
      if (groups.length === 0 || groups[groups.length - 1].label !== label)
        groups.push({ label, days: 1 });
      else
        groups[groups.length - 1].days++;
    }
    return groups;
  }, [rangeStart, totalDays]);

  // ── Day cells for header row 2 ───────────────────────────────────────────
  const dayArray = useMemo(() => Array.from({ length: totalDays }, (_, i) => {
    const iso = addDays(rangeStart, i);
    const d   = toDate(iso);
    return { iso, dayNum: d.getDate(), isWeekend: d.getDay() === 0 || d.getDay() === 6 };
  }), [rangeStart, totalDays]);

  // ── Today line x-position (null if outside range) ───────────────────────
  const todayX = useMemo(() => {
    const diff = daysBetween(rangeStart, todayIso);
    return diff >= 0 && diff < totalDays ? LEFT_W + diff * DAY_W + DAY_W / 2 : null;
  }, [rangeStart, todayIso, totalDays]);

  // ── Bar geometry ─────────────────────────────────────────────────────────
  const barGeometry = useCallback((wp: WorkPackage) => {
    const s = daysBetween(rangeStart, wp.startDate);
    const e = daysBetween(rangeStart, wp.endDate) + 1; // end is inclusive
    if (s >= totalDays || e <= 0) return null;          // completely out of view
    const cs = Math.max(0, s);
    const ce = Math.min(totalDays, e);
    return { left: cs * DAY_W, width: Math.max(DAY_W * 0.5, (ce - cs) * DAY_W) };
  }, [rangeStart, totalDays]);

  // ── Persist ──────────────────────────────────────────────────────────────
  const persist = useCallback(async (newWps: WorkPackage[]) => {
    try {
      const updated = await projectsApi.update({
        ...project,
        requiredSkills: project.requiredSkills ?? [],
        workPackages: newWps,
      });
      onUpdate(updated);
    } catch (err) {
      console.error(err);
      setWps(project.workPackages ?? []);
    }
  }, [project, onUpdate]);

  // ── Document-level drag handlers ─────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = Math.round((e.clientX - drag.originX) / DAY_W);
      setWps(prev => prev.map(wp => {
        if (wp.id !== drag.wpId) return wp;
        if (drag.type === 'move') {
          return { ...wp, startDate: addDays(drag.origStart, delta), endDate: addDays(drag.origEnd, delta) };
        }
        if (drag.type === 'resize-left') {
          const ns = addDays(drag.origStart, delta);
          return ns >= drag.origEnd ? wp : { ...wp, startDate: ns };
        }
        // resize-right
        const ne = addDays(drag.origEnd, delta);
        return ne < drag.origStart ? wp : { ...wp, endDate: ne };
      }));
    };

    const onUp = async () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setIsDragging(false);
      await persist(wpsRef.current);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [persist]);

  const onBarMouseDown = useCallback((e: React.MouseEvent, wp: WorkPackage, type: DragType) => {
    if (!isManager) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { wpId: wp.id, type, originX: e.clientX, origStart: wp.startDate, origEnd: wp.endDate };
    setIsDragging(true);
  }, [isManager]);

  // ── DSFR modal form handlers ─────────────────────────────────────────────
  const formTitleErr = formSubmitted && !formTitle.trim();
  const formStartErr = formSubmitted && !formStart;
  const formEndErr   = formSubmitted && (!formEnd || (!!formStart && formEnd < formStart));

  const handleModalSave = useCallback(async () => {
    setFormSubmitted(true);
    if (!formTitle.trim() || !formStart || !formEnd || formEnd < formStart) return;
    const wp: WorkPackage = {
      id: editingWp?.id ?? crypto.randomUUID(),
      title: formTitle.trim(),
      startDate: formStart,
      endDate: formEnd,
      color: formColor,
    };
    const newWps = editingWp ? wps.map(w => w.id === wp.id ? wp : w) : [...wps, wp];
    setWps(newWps);
    wpModal.close();
    await persist(newWps);
  }, [editingWp, formTitle, formStart, formEnd, formColor, wps, persist]);

  const handleModalDelete = useCallback(async () => {
    if (!editingWp) return;
    const newWps = wps.filter(w => w.id !== editingWp.id);
    setWps(newWps);
    wpModal.close();
    await persist(newWps);
  }, [editingWp, wps, persist]);

  // Compute DSFR modal buttons based on current UI state
  type BtnArr = [ModalProps.ActionAreaButtonProps, ...ModalProps.ActionAreaButtonProps[]];
  const modalButtons: BtnArr = showDeleteConfirm
    ? [
        {
          children: t('roadmap.cancel'),
          priority: 'secondary',
          onClick: () => setShowDeleteConfirm(false),
          doClosesModal: false,
        },
        {
          children: t('roadmap.delete'),
          priority: 'primary',
          onClick: handleModalDelete,
          doClosesModal: false,
        },
      ]
    : editingWp
    ? [
        {
          children: t('roadmap.delete'),
          priority: 'tertiary no outline',
          iconId: 'fr-icon-delete-bin-line',
          onClick: () => setShowDeleteConfirm(true),
          doClosesModal: false,
        },
        {
          children: t('roadmap.cancel'),
          priority: 'secondary',
          onClick: () => wpModal.close(),
          doClosesModal: false,
        },
        {
          children: t('roadmap.save'),
          priority: 'primary',
          onClick: handleModalSave,
          doClosesModal: false,
        },
      ]
    : [
        {
          children: t('roadmap.cancel'),
          priority: 'secondary',
          onClick: () => wpModal.close(),
          doClosesModal: false,
        },
        {
          children: t('roadmap.save'),
          priority: 'primary',
          onClick: handleModalSave,
          doClosesModal: false,
        },
      ];

  // ── Shared style helpers ─────────────────────────────────────────────────
  const rowBorder = { borderBottom: '1px solid', borderColor: 'divider' } as const;
  const stickyCell = (bg = BG, zIndex = 2) => ({
    width: LEFT_W, flexShrink: 0, position: 'sticky' as const, left: 0,
    bgcolor: bg, zIndex, borderRight: '1px solid', borderColor: 'divider',
  });

  const TLINE_W = totalDays * DAY_W;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Box sx={{ userSelect: isDragging ? 'none' : 'auto' }}>
      {isManager && wps.length > 0 && (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1 }}>
          {t('roadmap.dragHint')}
        </Typography>
      )}

      <Box sx={{
        overflowX: 'auto', border: '1px solid', borderColor: 'divider',
        borderRadius: 1.5, bgcolor: BG, position: 'relative',
      }}>
        {/* ── Today vertical line (spans the full table height) ── */}
        {todayX !== null && (
          <Box sx={{
            position: 'absolute', left: todayX, top: 0, bottom: 0, width: 2,
            bgcolor: TODAY_COLOR, opacity: 0.45, zIndex: 5, pointerEvents: 'none',
          }} />
        )}

        <Box sx={{ minWidth: LEFT_W + TLINE_W }}>

          {/* ── Month header ── */}
          <Box sx={{ display: 'flex', ...rowBorder, bgcolor: HDR_BG }}>
            <Box sx={{ ...stickyCell(HDR_BG, 4), height: HDR_H, display: 'flex', alignItems: 'center', px: 1.5 }}>
              <Typography variant="caption" fontWeight={700} color="text.disabled"
                sx={{ letterSpacing: 0.5, textTransform: 'uppercase', fontSize: '0.62rem' }}>
                {t('roadmap.workPackageTitle')}
              </Typography>
            </Box>
            {monthGroups.map((mg, i) => (
              <Box key={i} sx={{
                width: mg.days * DAY_W, flexShrink: 0, height: HDR_H,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRight: '1px solid', borderColor: 'divider', overflow: 'hidden',
              }}>
                <Typography variant="caption" fontWeight={700}
                  sx={{ fontSize: '0.68rem', color: 'text.secondary', whiteSpace: 'nowrap', px: 0.5 }}>
                  {mg.label}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* ── Day header ── */}
          <Box sx={{ display: 'flex', ...rowBorder, bgcolor: HDR_BG }}>
            <Box sx={{ ...stickyCell(HDR_BG, 4), height: HDR_H }} />
            {dayArray.map((day, i) => (
              <Box key={i} sx={{
                width: DAY_W, flexShrink: 0, height: HDR_H,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: day.isWeekend ? 'rgba(255,255,255,0.02)' : 'transparent',
                borderRight: day.dayNum === 1 ? '1px solid' : 'none', borderColor: 'divider',
              }}>
                <Typography sx={{
                  fontSize: '0.58rem', lineHeight: 1,
                  color: todayIso === day.iso ? TODAY_COLOR : day.isWeekend ? 'text.disabled' : 'text.secondary',
                  fontWeight: todayIso === day.iso ? 800 : 400,
                }}>
                  {day.dayNum}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* ── Empty state ── */}
          {wps.length === 0 && (
            <Box sx={{ display: 'flex', ...rowBorder }}>
              <Box sx={{ ...stickyCell(), height: ROW_H, display: 'flex', alignItems: 'center', px: 1.5 }}>
                <Typography variant="caption" color="text.disabled" fontStyle="italic">
                  {t('roadmap.empty')}
                </Typography>
              </Box>
              <Box sx={{ width: TLINE_W, height: ROW_H }} />
            </Box>
          )}

          {/* ── WP rows ── */}
          {wps.map(wp => {
            const geo = barGeometry(wp);
            return (
              <Box key={wp.id} sx={{ display: 'flex', ...rowBorder, '&:last-of-type': { borderBottom: 'none' } }}>

                {/* Sticky title cell */}
                <Box sx={{ ...stickyCell(), height: ROW_H, display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, overflow: 'hidden' }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: wp.color, flexShrink: 0 }} />
                  <Typography variant="body2" noWrap sx={{ flex: 1, fontSize: '0.8rem' }}>
                    {wp.title}
                  </Typography>
                  {isManager && (
                    <Box sx={{ flexShrink: 0, opacity: 0.45, '&:hover': { opacity: 1 }, transition: 'opacity 0.15s' }}>
                      <Button
                        title={t('roadmap.editWorkPackage')}
                        iconId="fr-icon-edit-line"
                        priority="tertiary no outline"
                        size="small"
                        onClick={() => openEdit(wp)}
                        nativeButtonProps={{ style: { padding: '0.1rem' } }}
                      />
                    </Box>
                  )}
                </Box>

                {/* Timeline cell */}
                <Box sx={{ width: TLINE_W, height: ROW_H, position: 'relative', flexShrink: 0 }}>
                  {geo && (
                    <Box sx={{
                      position: 'absolute', left: geo.left, width: geo.width,
                      top: BAR_PAD, height: ROW_H - BAR_PAD * 2,
                      borderRadius: 1, bgcolor: wp.color, opacity: 0.82,
                      display: 'flex', alignItems: 'center', zIndex: 2,
                    }}>
                      {/* Left resize handle */}
                      <Box
                        onMouseDown={e => onBarMouseDown(e, wp, 'resize-left')}
                        sx={{
                          position: 'absolute', left: 0, top: 0, width: HANDLE_W, height: '100%',
                          cursor: isManager ? 'ew-resize' : 'default', zIndex: 3,
                          borderRadius: '4px 0 0 4px',
                          '&:hover': isManager ? { bgcolor: 'rgba(0,0,0,0.2)' } : {},
                        }}
                      />
                      {/* Bar body: move */}
                      <Box
                        onMouseDown={e => onBarMouseDown(e, wp, 'move')}
                        sx={{
                          position: 'absolute', left: HANDLE_W, right: HANDLE_W,
                          top: 0, height: '100%',
                          cursor: isManager ? 'grab' : 'default',
                          display: 'flex', alignItems: 'center', px: 0.5, overflow: 'hidden',
                          '&:active': isManager ? { cursor: 'grabbing' } : {},
                        }}
                      >
                        {geo.width > 60 && (
                          <Typography sx={{
                            fontSize: '0.68rem', fontWeight: 600, whiteSpace: 'nowrap',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            color: 'rgba(0,0,0,0.72)', pointerEvents: 'none', userSelect: 'none',
                          }}>
                            {wp.title}
                          </Typography>
                        )}
                      </Box>
                      {/* Right resize handle */}
                      <Box
                        onMouseDown={e => onBarMouseDown(e, wp, 'resize-right')}
                        sx={{
                          position: 'absolute', right: 0, top: 0, width: HANDLE_W, height: '100%',
                          cursor: isManager ? 'ew-resize' : 'default', zIndex: 3,
                          borderRadius: '0 4px 4px 0',
                          '&:hover': isManager ? { bgcolor: 'rgba(0,0,0,0.2)' } : {},
                        }}
                      />
                    </Box>
                  )}
                </Box>
              </Box>
            );
          })}

          {/* ── Add button row (manager only) ── */}
          {isManager && (
            <Box sx={{ display: 'flex' }}>
              <Box sx={{ ...stickyCell(), py: 0.75, px: 1, display: 'flex', alignItems: 'center' }}>
                <Button
                  size="small"
                  iconId="fr-icon-add-line"
                  priority="tertiary no outline"
                  onClick={openCreate}
                >
                  {t('roadmap.addWorkPackage')}
                </Button>
              </Box>
              <Box sx={{ flex: 1 }} />
            </Box>
          )}
        </Box>
      </Box>

      {/* ── DSFR modal: create / edit / delete-confirm ── */}
      <wpModal.Component
        title={
          showDeleteConfirm
            ? t('roadmap.confirmDeleteTitle')
            : editingWp
            ? t('roadmap.editWorkPackage')
            : t('roadmap.addWorkPackage')
        }
        buttons={modalButtons}
      >
        {showDeleteConfirm ? (
          <Typography>{t('roadmap.confirmDelete')}</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Input
              label={t('roadmap.workPackageTitle')}
              state={formTitleErr ? 'error' : 'default'}
              stateRelatedMessage={formTitleErr ? t('roadmap.errorTitleRequired') : undefined}
              nativeInputProps={{
                value: formTitle,
                onChange: e => setFormTitle(e.target.value),
                autoFocus: true,
              }}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Input
                  label={t('roadmap.startDate')}
                  state={formStartErr ? 'error' : 'default'}
                  stateRelatedMessage={formStartErr ? t('roadmap.errorStartRequired') : undefined}
                  nativeInputProps={{
                    type: 'date',
                    value: formStart,
                    onChange: e => setFormStart(e.target.value),
                  }}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Input
                  label={t('roadmap.endDate')}
                  state={formEndErr ? 'error' : 'default'}
                  stateRelatedMessage={formEndErr ? t('roadmap.errorEndBeforeStart') : undefined}
                  nativeInputProps={{
                    type: 'date',
                    value: formEnd,
                    onChange: e => setFormEnd(e.target.value),
                  }}
                />
              </Box>
            </Box>
            {/* Color swatches */}
            <Box>
              <Typography
                variant="caption"
                sx={{ display: 'block', mb: 0.75, color: 'var(--text-mention-grey)' }}
              >
                {t('roadmap.colorLabel')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {WP_COLORS.map(c => (
                  <Box
                    key={c}
                    role="radio"
                    aria-checked={formColor === c}
                    tabIndex={0}
                    onClick={() => setFormColor(c)}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setFormColor(c)}
                    sx={{
                      width: 24, height: 24, borderRadius: '50%', bgcolor: c,
                      cursor: 'pointer', boxSizing: 'border-box',
                      border: formColor === c ? '3px solid var(--text-default-grey)' : '2px solid transparent',
                      outline: 'none',
                      transition: 'transform 0.15s',
                      '&:hover, &:focus-visible': { transform: 'scale(1.25)' },
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        )}
      </wpModal.Component>
    </Box>
  );
}
