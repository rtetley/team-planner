import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Box, Checkbox, SxProps, Theme } from '@mui/material';
import type { Components } from 'react-markdown';

const components: Components = {
  // ── Block elements ─────────────────────────────────────────────────────────
  p:          ({ children }) => <p style={{ margin: '0 0 6px' }}>{children}</p>,
  h1:         ({ children }) => <h1 style={{ fontSize: '1.25rem', margin: '12px 0 6px', fontWeight: 700 }}>{children}</h1>,
  h2:         ({ children }) => <h2 style={{ fontSize: '1.1rem',  margin: '10px 0 4px', fontWeight: 700 }}>{children}</h2>,
  h3:         ({ children }) => <h3 style={{ fontSize: '1rem',   margin: '8px 0 4px',  fontWeight: 600 }}>{children}</h3>,

  // ── Lists ─────────────────────────────────────────────────────────────────
  ul: ({ children }) => (
    <ul style={{ margin: '4px 0 6px', paddingLeft: 20, listStyleType: 'disc' }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ margin: '4px 0 6px', paddingLeft: 20, listStyleType: 'decimal' }}>{children}</ol>
  ),
  li: ({ children, node }) => {
    // GFM task list items — node has `checked` on the first child input
    const firstChild = node?.children?.[0];
    const isTask =
      firstChild?.type === 'element' &&
      firstChild.tagName === 'input' &&
      firstChild.properties?.type === 'checkbox';

    if (isTask) {
      const checked = !!(firstChild as { properties?: { checked?: boolean } }).properties?.checked;
      // Filter out the raw <input> element from children and render it as a Checkbox
      const rest = Array.isArray(children)
        ? (children as React.ReactNode[]).slice(1)
        : children;
      return (
        <li style={{ listStyle: 'none', display: 'flex', alignItems: 'flex-start', gap: 4, marginLeft: -20 }}>
          <Checkbox
            checked={checked}
            disabled
            size="small"
            sx={{ p: 0, mt: '1px', color: checked ? 'success.main' : 'text.disabled',
                 '&.Mui-disabled': { color: checked ? 'success.main' : 'text.disabled' } }}
          />
          <span style={{ flex: 1 }}>{rest}</span>
        </li>
      );
    }

    return <li style={{ marginBottom: 2 }}>{children}</li>;
  },

  // ── Inline ────────────────────────────────────────────────────────────────
  code: ({ children, className }) => {
    const isBlock = className?.startsWith('language-');
    return isBlock ? (
      <pre style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 4, padding: '8px 10px', overflow: 'auto', fontSize: '0.82rem', margin: '6px 0' }}>
        <code>{children}</code>
      </pre>
    ) : (
      <code style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 3, padding: '1px 4px', fontSize: '0.85em' }}>{children}</code>
    );
  },
  blockquote: ({ children }) => (
    <blockquote style={{ borderLeft: '3px solid', borderColor: 'rgba(148,163,184,0.4)', margin: '4px 0', paddingLeft: 10, color: 'inherit', opacity: 0.8 }}>
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" style={{ color: 'inherit', opacity: 0.85, textDecorationColor: 'currentColor' }}>
      {children}
    </a>
  ),
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid rgba(148,163,184,0.25)', margin: '8px 0' }} />,
};

interface MarkdownRendererProps {
  children: string;
  sx?: SxProps<Theme>;
}

export default function MarkdownRenderer({ children, sx }: MarkdownRendererProps) {
  return (
    <Box sx={{ fontSize: '0.875rem', lineHeight: 1.6, ...sx }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </Box>
  );
}
