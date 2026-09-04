'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type SetStateAction,
} from 'react';
import {
  Activity,
  Bot,
  Boxes,
  Braces,
  CheckCircle2,
  ChevronRight,
  Command,
  Download,
  FileCog,
  FileText,
  Gauge,
  GitBranch,
  History,
  Home,
  KeyRound,
  Languages,
  LayoutDashboard,
  LockKeyhole,
  Moon,
  Palette,
  Play,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Upload,
  Workflow,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  createLocalCredential,
  decryptLocalValue,
  encryptLocalValue,
  parsePersonalVocabulary,
  unlockLocalCredential,
  type EncryptedLocalValue,
  type LocalCredentialRecord,
  type PersonalVocabulary,
} from '@/lib/local-private';
import { SITE_PROVENANCE } from '@/.generated/site-provenance';
import { describeElement, PrivateOperationEpoch } from '@/lib/private-boundary';

type TabId =
  | 'home'
  | 'operations'
  | 'features'
  | 'documentation'
  | 'status'
  | 'downloads'
  | 'settings';
type LanguageMode = 'English' | 'Cantonese' | 'Bilingual';

const navigation: Array<{
  id: TabId;
  label: string;
  zh: string;
  icon: typeof Home;
}> = [
  { id: 'home', label: 'Home', zh: '首頁', icon: Home },
  { id: 'operations', label: 'Operations', zh: '操作', icon: Workflow },
  { id: 'features', label: 'Features', zh: '功能', icon: Boxes },
  { id: 'documentation', label: 'Documentation', zh: '文件', icon: FileText },
  { id: 'status', label: 'Status', zh: '狀態', icon: Activity },
  { id: 'downloads', label: 'Downloads', zh: '下載', icon: Download },
  { id: 'settings', label: 'Settings', zh: '設定', icon: Settings },
];

const operationCards = [
  {
    icon: GitBranch,
    title: 'Source control',
    detail:
      'Review repositories, branches, changes, and verified remote state.',
    state: 'Ready',
    tone: 'good',
  },
  {
    icon: Boxes,
    title: 'Containers',
    detail:
      'Inspect configured container hosts before running allowlisted actions.',
    state: 'Not configured',
    tone: 'quiet',
  },
  {
    icon: Bot,
    title: 'Local models',
    detail:
      'Check the local runtime, models, hardware fit, and queued downloads.',
    state: 'Checking locally',
    tone: 'active',
  },
  {
    icon: FileCog,
    title: 'Files and conversion',
    detail: 'Queue bounded local conversions with previews and validation.',
    state: 'Ready',
    tone: 'good',
  },
];

const featureGroups = [
  [
    'Work control',
    'Projects, tasks, operations, evidence, schedules, retries, cancellation, and independently verified outcomes.',
  ],
  [
    'Private wording',
    'A local file can change eligible interface wording after complete validation. Public and technical text stays original.',
  ],
  [
    'Navigation and search',
    'Edge-dockable tabs, pinning, groups, four tab searches, command palette, and a full regular-expression workbench.',
  ],
  [
    'Appearance',
    'Theme, density, accent, fonts, per-element editing, continuous color tools, presets, history, and reset.',
  ],
  [
    'Safety and recovery',
    'Two-key destructive confirmation, novelty locks, local support tickets, notifications, and append-only recovery history.',
  ],
  [
    'Local tools',
    'File conversion, PDF operations, local model management, authenticator codes, external editors, and complete exports.',
  ],
  [
    'Accessibility',
    'Keyboard operation, visible focus, screen-reader state, reduced motion, large targets, and layouts from 320 pixels upward.',
  ],
  [
    'Attention support',
    'Independent focus, low-stimulation, time-awareness, one-next-action, and momentum modes, all off by default.',
  ],
];

const operationRows = [
  ['Refresh local repository state', 'Source control', 'Read only', 'Ready'],
  ['Inspect local model runtime', 'Local models', 'Read only', 'Ready'],
  ['Validate documentation output', 'Documentation', 'Read only', 'Ready'],
  ['Build Windows package', 'Build', 'Writes output', 'Needs clean source'],
  ['Publish a release', 'GitHub', 'External write', 'Needs review'],
];

type SearchConfig = {
  builder: boolean;
  regex: boolean;
  flags: string;
  sample: string;
  replacement: string;
};

const defaultSearchConfig: SearchConfig = {
  builder: false,
  regex: false,
  flags: 'iu',
  sample: '',
  replacement: '',
};

function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const initialRef = useRef(initial);
  useEffect(() => {
    const stored = window.localStorage.getItem(key);
    if (!stored) {
      window.localStorage.setItem(key, JSON.stringify(initialRef.current));
      return;
    }
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        setValue(JSON.parse(stored) as T);
      } catch {
        window.localStorage.removeItem(key);
      }
    });
    return () => {
      active = false;
    };
  }, [key]);
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; value: unknown }>)
        .detail;
      if (detail?.key === key) setValue(detail.value as T);
    };
    window.addEventListener('wording-lens-setting', receive);
    return () => window.removeEventListener('wording-lens-setting', receive);
  }, [key]);
  const setStoredValue = useCallback<Dispatch<SetStateAction<T>>>(
    (next) => {
      setValue((current) => {
        const resolved =
          typeof next === 'function'
            ? (next as (value: T) => T)(current)
            : next;
        window.localStorage.setItem(key, JSON.stringify(resolved));
        window.dispatchEvent(
          new CustomEvent('wording-lens-setting', {
            detail: { key, value: resolved },
          }),
        );
        return resolved;
      });
    },
    [key],
  );
  return [value, setStoredValue] as const;
}

function sliderNumber(
  value: number | readonly number[],
  fallback: number,
): number {
  return typeof value === 'number' ? value : (value[0] ?? fallback);
}

function safeSearchFlags(flags: string): string {
  return [...new Set(flags.replace(/[^dgimsuvy]/g, ''))].join('');
}

function riskyPattern(pattern: string): boolean {
  return (
    /\([^()]*(?:[+*]|\{\d+,\})[^()]*\)(?:[+*]|\{\d+,\})/.test(pattern) ||
    /\([^()|]+\|[^()|]+\)(?:[+*]|\{\d+,\})/.test(pattern)
  );
}

function compileSearch(query: string, config: SearchConfig): RegExp | null {
  if (!config.regex || !query) return null;
  if (query.length > 4096 || riskyPattern(query)) return null;
  try {
    return new RegExp(query, safeSearchFlags(config.flags));
  } catch {
    return null;
  }
}

function matchesSearch(
  text: string,
  query: string,
  config: SearchConfig,
): boolean {
  if (!query) return true;
  if (!config.regex)
    return text.toLocaleLowerCase().includes(query.toLocaleLowerCase());
  const expression = compileSearch(query, config);
  return expression ? expression.test(text.slice(0, 1_000_000)) : false;
}

function SearchWorkbench({
  scope,
  query,
  onQuery,
  config,
  onConfig,
}: {
  scope: string;
  query: string;
  onQuery: (value: string) => void;
  config: SearchConfig;
  onConfig: Dispatch<SetStateAction<SearchConfig>>;
}) {
  const valid = useMemo(() => {
    if (!config.regex || !query) return true;
    return compileSearch(query, config) !== null;
  }, [config, query]);
  const sampleMatches = useMemo(() => {
    if (!config.sample || !query || !valid) return [] as string[];
    if (!config.regex) {
      return config.sample
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase())
        ? [query]
        : [];
    }
    const flags = safeSearchFlags(config.flags).replace(/[gy]/g, '') + 'g';
    try {
      return Array.from(
        config.sample.slice(0, 1_000_000).matchAll(new RegExp(query, flags)),
        (match) => match[0],
      ).slice(0, 1000);
    } catch {
      return [] as string[];
    }
  }, [config.flags, config.regex, config.sample, query, valid]);
  const preview = useMemo(() => {
    if (!config.sample || !query || !valid) return config.sample;
    if (!config.regex)
      return config.sample.replaceAll(query, config.replacement);
    try {
      return config.sample.replace(
        new RegExp(query, safeSearchFlags(config.flags)),
        config.replacement,
      );
    } catch {
      return config.sample;
    }
  }, [config, query, valid]);
  const regexId = `${scope}-search-regex`;
  const flagsId = `${scope}-search-flags`;
  const sampleId = `${scope}-search-sample`;
  const replacementId = `${scope}-search-replacement`;
  return (
    <div className="search-workbench">
      <div className="search-row">
        <Search aria-hidden="true" size={19} />
        <Input
          aria-label="Search this page"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search this page"
        />
        <Button
          variant={config.builder ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() =>
            onConfig((value) => ({ ...value, builder: !value.builder }))
          }
          aria-expanded={config.builder}
          aria-label="Open regular expression builder"
        >
          <Braces aria-hidden="true" size={18} /> Builder
        </Button>
      </div>
      {config.builder && (
        <section
          className="regex-panel"
          aria-label="Regular expression builder"
        >
          <div>
            <strong>Regular-expression workbench</strong>
            <p>Plain text stays active until you enable the pattern.</p>
          </div>
          <label className="control-line" htmlFor={regexId}>
            <Switch
              id={regexId}
              checked={config.regex}
              onCheckedChange={(regex) =>
                onConfig((value) => ({ ...value, regex }))
              }
            />{' '}
            Use regular expression
          </label>
          <label htmlFor={flagsId}>
            Flags
            <Input
              id={flagsId}
              aria-label="Regular expression flags"
              value={config.flags}
              onChange={(event) =>
                onConfig((value) => ({
                  ...value,
                  flags: safeSearchFlags(event.target.value),
                }))
              }
            />
          </label>
          <label htmlFor={sampleId}>
            Sample text
            <Input
              id={sampleId}
              value={config.sample}
              maxLength={1_000_000}
              onChange={(event) =>
                onConfig((value) => ({ ...value, sample: event.target.value }))
              }
            />
          </label>
          <label htmlFor={replacementId}>
            Replacement preview
            <Input
              id={replacementId}
              value={config.replacement}
              onChange={(event) =>
                onConfig((value) => ({
                  ...value,
                  replacement: event.target.value,
                }))
              }
            />
          </label>
          <output className={valid ? 'valid' : 'invalid'}>
            {valid
              ? `${sampleMatches.length} bounded sample matches. Preview: ${preview || 'empty'}`
              : 'Pattern is invalid and will not run.'}
          </output>
        </section>
      )}
    </div>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: string;
  children: React.ReactNode;
}) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function downloadText(
  filename: string,
  value: string,
  type = 'application/json',
) {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  queueMicrotask(() => URL.revokeObjectURL(url));
}

function NoMatches({ query }: { query: string }) {
  return (
    <section className="surface-card empty-panel" aria-live="polite">
      <Search aria-hidden="true" size={28} />
      <h2>No matching content</h2>
      <p>No item on this surface matches “{query}”.</p>
    </section>
  );
}

function HomePanel({
  setTab,
  query,
  search,
}: {
  setTab: (tab: TabId) => void;
  query: string;
  search: SearchConfig;
}) {
  const filteredCards = operationCards.filter((card) =>
    matchesSearch(`${card.title} ${card.detail} ${card.state}`, query, search),
  );
  return (
    <div className="panel-stack">
      <section className="welcome-card surface-card">
        <div>
          <span className="kicker">LOCAL OPERATIONS</span>
          <h2>One calm view of work that is actually happening</h2>
          <p>
            Inspect state first, preview the exact action, then run it with
            visible progress and an independent result check.
          </p>
        </div>
        <Button size="lg" onClick={() => setTab('operations')}>
          <Play aria-hidden="true" size={18} /> Open operations
        </Button>
      </section>
      <section aria-labelledby="adapter-heading">
        <div className="section-heading">
          <div>
            <span className="kicker">ADAPTER HEALTH</span>
            <h2 id="adapter-heading">Connected work surfaces</h2>
          </div>
          <Button variant="ghost" onClick={() => setTab('status')}>
            View status <ChevronRight aria-hidden="true" size={17} />
          </Button>
        </div>
        <div className="card-grid">
          {filteredCards.map(({ icon: Icon, title, detail, state, tone }) => (
            <article className="surface-card adapter-card" key={title}>
              <div className="icon-tile">
                <Icon aria-hidden="true" size={22} />
              </div>
              <div>
                <h3>{title}</h3>
                <p>{detail}</p>
              </div>
              <StatusPill tone={tone}>{state}</StatusPill>
            </article>
          ))}
        </div>
      </section>
      <section
        className="surface-card next-action"
        aria-labelledby="next-action-heading"
      >
        <div className="icon-tile mint">
          <Gauge aria-hidden="true" size={22} />
        </div>
        <div>
          <span className="kicker">ONE NEXT ACTION</span>
          <h2 id="next-action-heading">Choose a project to inspect</h2>
          <p>
            This value is user-selected, persistent, and never inferred from
            activity.
          </p>
        </div>
        <Button variant="outline" onClick={() => setTab('documentation')}>
          Read the project workflow
        </Button>
      </section>
      {query && filteredCards.length === 0 && <NoMatches query={query} />}
    </div>
  );
}

function OperationsPanel({
  query,
  search,
  notify,
}: {
  query: string;
  search: SearchConfig;
  notify: (message: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewAction, setPreviewAction] = useState(operationRows[0][0]);
  const filteredRows = operationRows.filter((row) =>
    matchesSearch(row.join(' '), query, search),
  );
  const toggle = (name: string) =>
    setSelected((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name],
    );
  return (
    <div className="panel-stack">
      <section className="section-heading">
        <div>
          <span className="kicker">GUIDED ACTIONS</span>
          <h2>Operations</h2>
          <p>
            Every action declares what it reads, what it changes, how it stops,
            and how the result is checked.
          </p>
        </div>
        <Button onClick={() => setPreviewOpen((value) => !value)}>
          <Play aria-hidden="true" size={18} /> New operation
        </Button>
      </section>
      {previewOpen && (
        <section
          className="surface-card settings-card"
          aria-label="Local operation preview"
        >
          <h2>Local operation preview</h2>
          <p>This documentation-only preview records no external change.</p>
          <label htmlFor="operation-preview-choice">
            Action
            <select
              id="operation-preview-choice"
              value={previewAction}
              onChange={(event) => setPreviewAction(event.target.value)}
            >
              {operationRows.map(([name]) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <div className="button-row">
            <Button
              onClick={() => {
                notify(`Previewed locally: ${previewAction}`);
                setPreviewOpen(false);
              }}
            >
              Confirm local preview
            </Button>
            <Button variant="ghost" onClick={() => setPreviewOpen(false)}>
              Cancel
            </Button>
          </div>
        </section>
      )}
      {selected.length > 0 && (
        <div className="selection-bar">
          <strong>{selected.length} selected</strong>
          <Button
            variant="outline"
            onClick={() =>
              downloadText(
                'wording-lens-operation-selection.json',
                JSON.stringify({ schemaVersion: 1, selected }, null, 2),
              )
            }
          >
            Export selection
          </Button>
          <Button variant="outline" onClick={() => setSelected([])}>
            Clear
          </Button>
        </div>
      )}
      <section className="surface-card table-card">
        <table aria-label="Available operations">
          <thead>
            <tr>
              <th scope="col">Select</th>
              <th scope="col">Action</th>
              <th scope="col">Adapter</th>
              <th scope="col">Impact</th>
              <th scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(([name, adapter, impact, state]) => (
              <tr key={name}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${name}`}
                    checked={selected.includes(name)}
                    onChange={() => toggle(name)}
                  />
                </td>
                <th scope="row">{name}</th>
                <td>{adapter}</td>
                <td>{impact}</td>
                <td>
                  <StatusPill tone={state === 'Ready' ? 'good' : 'quiet'}>
                    {state}
                  </StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {query && filteredRows.length === 0 && <NoMatches query={query} />}
    </div>
  );
}

function FeaturesPanel({
  query,
  search,
}: {
  query: string;
  search: SearchConfig;
}) {
  const filtered = featureGroups.filter(([title, detail]) =>
    matchesSearch(`${title} ${detail}`, query, search),
  );
  return (
    <div className="feature-grid">
      {filtered.map(([title, detail], index) => (
        <article className="surface-card feature-card" key={title}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <div>
            <h2>{title}</h2>
            <p>{detail}</p>
          </div>
        </article>
      ))}
      {query && filtered.length === 0 && <NoMatches query={query} />}
    </div>
  );
}

function DocumentationPanel({
  query,
  search,
}: {
  query: string;
  search: SearchConfig;
}) {
  const articles = [
    'Getting started',
    'Operation adapters',
    'Private wording file',
    'Tabs and search',
    'Appearance and accessibility',
    'Safety and recovery',
    'File conversion',
    'Local model management',
    'Authenticator and history',
    'Builds, updates, and releases',
  ];
  const filtered = articles.filter((article) =>
    matchesSearch(article, query, search),
  );
  const [selected, setSelected] = useState(articles[0]);
  return (
    <div className="docs-layout">
      <aside className="surface-card docs-list">
        {filtered.map((article) => (
          <button
            className={selected === article ? 'active' : ''}
            key={article}
            onClick={() => setSelected(article)}
          >
            {article}
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        ))}
      </aside>
      <article className="surface-card article">
        <span className="kicker">OFFLINE ARTICLE</span>
        <h2>{selected}</h2>
        <p>
          The installed application opens without sample projects or invented
          activity. Add a local project, choose which adapter may inspect it,
          and review the discovered state before enabling any write action.
        </p>
        <h3>What stays local</h3>
        <p>
          Project records, personal wording, authenticator data, history, and
          interface settings stay on the current device. Public links and
          provider records retain their original wording.
        </p>
        <h3>Suggested articles</h3>
        <div className="link-chips">
          <button onClick={() => setSelected('Operation adapters')}>
            Operation adapters
          </button>
          <button onClick={() => setSelected('Safety and recovery')}>
            Safety and recovery
          </button>
          <button onClick={() => setSelected('Private wording file')}>
            Private wording file
          </button>
        </div>
      </article>
      {query && filtered.length === 0 && <NoMatches query={query} />}
    </div>
  );
}

function StatusPanel({
  query,
  search,
}: {
  query: string;
  search: SearchConfig;
}) {
  if (
    !matchesSearch(
      'current build foundation progress verified implementation workstreams published private data',
      query,
      search,
    )
  )
    return <NoMatches query={query} />;
  return (
    <div className="panel-stack">
      <section className="surface-card status-hero">
        <div>
          <span className="kicker">CURRENT BUILD</span>
          <h2>Foundation in progress</h2>
          <p>The first public release has not been published.</p>
        </div>
        <StatusPill tone="active">Building</StatusPill>
        <Progress value={28} />
        <span>28% of the current implementation plan</span>
      </section>
      <div className="card-grid">
        <article className="surface-card metric">
          <CheckCircle2 size={22} />
          <strong>4</strong>
          <span>Verified foundation items</span>
        </article>
        <article className="surface-card metric">
          <Workflow size={22} />
          <strong>8</strong>
          <span>Implementation workstreams</span>
        </article>
        <article className="surface-card metric">
          <ShieldCheck size={22} />
          <strong>0</strong>
          <span>Published private-data findings</span>
        </article>
      </div>
    </div>
  );
}

function DownloadsPanel({
  query,
  search,
}: {
  query: string;
  search: SearchConfig;
}) {
  if (
    !matchesSearch(
      'verified installer unsigned Windows Squirrel download unavailable publisher warning',
      query,
      search,
    )
  )
    return <NoMatches query={query} />;
  return (
    <section className="surface-card empty-panel">
      <div className="icon-tile">
        <Download size={28} />
      </div>
      <h2>No verified installer yet</h2>
      <p>
        The download button stays absent until a real unsigned Squirrel.Windows
        installer is published and read back from the release.
      </p>
      <Button variant="outline" disabled>
        Windows installer unavailable
      </Button>
      <small>
        Installing an unsigned build may show an unknown-publisher warning.
      </small>
    </section>
  );
}

function SettingsPanel({
  dark,
  setDark,
  notify,
  setTab,
  query = '',
  search = defaultSearchConfig,
  schoolEnabled,
  setSchoolEnabled,
}: {
  dark: boolean;
  setDark: Dispatch<SetStateAction<boolean>>;
  notify: (message: string) => void;
  setTab: (tab: TabId, focusHeading?: boolean) => void;
  query?: string;
  search?: SearchConfig;
  schoolEnabled: boolean;
  setSchoolEnabled: Dispatch<SetStateAction<boolean>>;
}) {
  const [language, setLanguage] = useStoredState<LanguageMode>(
    'wl.language',
    'English',
  );
  const [englishTone, setEnglishTone] = useStoredState('wl.tone.en', 5);
  const [cantoneseTone, setCantoneseTone] = useStoredState('wl.tone.zh', 5);
  const [emoji, setEmoji] = useStoredState('wl.emoji', true);
  const [focus, setFocus] = useStoredState('wl.focus', false);
  const [lowStim, setLowStim] = useStoredState('wl.lowStim', false);
  const [timeAware, setTimeAware] = useStoredState('wl.timeAware', false);
  const [oneThing, setOneThing] = useStoredState('wl.oneThing', false);
  const [momentum, setMomentum] = useStoredState('wl.momentum', false);
  const [density, setDensity] = useStoredState('wl.density', 'Comfortable');
  const [accent, setAccent] = useStoredState('wl.accent', '#4fcfff');
  const [narration, setNarration] = useStoredState('wl.narration', false);
  const [englishVoice, setEnglishVoice] = useStoredState('wl.voice.en', 'auto');
  const [cantoneseVoice, setCantoneseVoice] = useStoredState(
    'wl.voice.zh',
    'auto',
  );
  const [speechRate, setSpeechRate] = useStoredState('wl.voice.rate', 1);
  const [speechPitch, setSpeechPitch] = useStoredState('wl.voice.pitch', 1);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleStart, setScheduleStart] = useStoredState(
    'wl.schedule.start',
    '09:00',
  );
  const [scheduleEnd, setScheduleEnd] = useStoredState(
    'wl.schedule.end',
    '17:00',
  );
  const [toolPanel, setToolPanel] = useState<
    'locks' | 'authenticator' | 'history' | null
  >(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [schoolName, setSchoolName] = useStoredState(
    'wl.school.name',
    'School mode',
  );
  const [schoolCredential, setSchoolCredential] =
    useStoredState<LocalCredentialRecord | null>('wl.school.credential', null);
  const [schoolUnlock, setSchoolUnlock] = useState('');
  const [schoolMessage, setSchoolMessage] = useState(
    'This is an interface lock, not a security boundary.',
  );
  const [fileState, setFileState] = useState('No private wording file loaded.');
  const [credentialExists, setCredentialExists] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [unlockValue, setUnlockValue] = useState('');
  const [localKey, setLocalKey] = useState<Uint8Array | null>(null);
  const [privateVocabulary, setPrivateVocabulary] =
    useState<PersonalVocabulary | null>(null);
  const [atlasOpen, setAtlasOpen] = useState(false);
  const [atlasQuery, setAtlasQuery] = useState('');
  const [atlasPage, setAtlasPage] = useState(0);
  const [atlasSearch, setAtlasSearch] = useState<SearchConfig>({
    ...defaultSearchConfig,
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const wordingEpoch = useRef(new PrivateOperationEpoch());
  const keyRef = useRef<Uint8Array | null>(null);

  function lockPrivateProfile() {
    wordingEpoch.current.invalidate();
    keyRef.current?.fill(0);
    keyRef.current = null;
    setUnlocked(false);
    setLocalKey(null);
    setPrivateVocabulary(null);
    setAtlasOpen(false);
    setAtlasQuery('');
    setAtlasSearch({ ...defaultSearchConfig });
    setFileState('Local profile locked. Original wording is active.');
  }

  useEffect(
    () => () => {
      wordingEpoch.current.invalidate();
      keyRef.current?.fill(0);
      keyRef.current = null;
    },
    [],
  );

  useEffect(() => {
    document.documentElement.dataset.density = density.toLocaleLowerCase();
    document.documentElement.style.setProperty('--primary', accent);
  }, [accent, density]);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const refresh = () => setVoices(window.speechSynthesis.getVoices());
    queueMicrotask(refresh);
    window.speechSynthesis.addEventListener('voiceschanged', refresh);
    return () =>
      window.speechSynthesis.removeEventListener('voiceschanged', refresh);
  }, []);

  useEffect(() => {
    queueMicrotask(() =>
      setCredentialExists(
        window.localStorage.getItem('wl.localCredential') !== null,
      ),
    );
  }, []);

  useEffect(() => {
    if (!localKey) return;
    const attempt = wordingEpoch.current.begin();
    let active = true;
    const cached = window.localStorage.getItem(
      'wl.privateVocabulary.encrypted',
    );
    if (!cached) return;
    void (async () => {
      try {
        const plaintext = await decryptLocalValue(
          JSON.parse(cached) as EncryptedLocalValue,
          localKey,
        );
        const parsed = parsePersonalVocabulary(plaintext);
        if (!active || !wordingEpoch.current.isCurrent(attempt)) return;
        setPrivateVocabulary(parsed);
        setFileState(
          'Private wording loaded locally from the validated encrypted cache.',
        );
      } catch {
        if (!active || !wordingEpoch.current.isCurrent(attempt)) return;
        window.localStorage.removeItem('wl.privateVocabulary.encrypted');
        setPrivateVocabulary(null);
        setFileState(
          'The local cache was invalid and was cleared. Original wording is active.',
        );
      }
    })();
    return () => {
      active = false;
    };
  }, [localKey]);

  async function createProfile() {
    const attempt = wordingEpoch.current.begin();
    try {
      const created = await createLocalCredential(unlockValue);
      if (!wordingEpoch.current.isCurrent(attempt)) {
        created.key.fill(0);
        return;
      }
      window.localStorage.setItem(
        'wl.localCredential',
        JSON.stringify(created.record),
      );
      setCredentialExists(true);
      setUnlocked(true);
      keyRef.current?.fill(0);
      keyRef.current = created.key;
      setLocalKey(created.key);
      setUnlockValue('');
    } catch (error) {
      if (!wordingEpoch.current.isCurrent(attempt)) return;
      setFileState(
        error instanceof Error
          ? error.message
          : 'The local profile could not be created.',
      );
    }
  }

  async function unlockProfile() {
    const attempt = wordingEpoch.current.begin();
    try {
      const raw = window.localStorage.getItem('wl.localCredential');
      if (!raw) {
        setFileState('Create the local private profile before unlocking it.');
        return;
      }
      const key = await unlockLocalCredential(
        unlockValue,
        JSON.parse(raw) as LocalCredentialRecord,
      );
      if (!wordingEpoch.current.isCurrent(attempt)) {
        key?.fill(0);
        return;
      }
      if (!key) {
        setFileState('The local unlock value did not match.');
        return;
      }
      setUnlocked(true);
      keyRef.current?.fill(0);
      keyRef.current = key;
      setLocalKey(key);
      setUnlockValue('');
    } catch {
      if (!wordingEpoch.current.isCurrent(attempt)) return;
      setFileState(
        'The local credential record was invalid. Reset local site data to recover.',
      );
    }
  }

  async function enableSchoolMode() {
    try {
      if (!schoolCredential) {
        const created = await createLocalCredential(schoolUnlock);
        setSchoolCredential(created.record);
      }
      setSchoolEnabled(true);
      lockPrivateProfile();
      setSchoolUnlock('');
      setSchoolMessage(
        `${schoolName} is active. English-only presentation is in effect.`,
      );
      notify(`${schoolName} enabled locally.`);
    } catch (error) {
      setSchoolMessage(
        error instanceof Error
          ? error.message
          : `${schoolName} could not be enabled.`,
      );
    }
  }

  async function disableSchoolMode() {
    if (!schoolCredential) {
      setSchoolMessage(
        'Clear this site’s storage to reset the missing local credential.',
      );
      return;
    }
    const key = await unlockLocalCredential(schoolUnlock, schoolCredential);
    if (!key) {
      setSchoolMessage('The local unlock value did not match.');
      return;
    }
    key.fill(0);
    setSchoolEnabled(false);
    setSchoolUnlock('');
    setSchoolMessage(
      `${schoolName} is off. Previous language and tone choices are restored.`,
    );
    notify(`${schoolName} disabled locally.`);
  }

  async function handleVocabulary(file?: File) {
    if (!file) return;
    if (!unlocked || !localKey) {
      setFileState(
        'Unlock the local private profile before choosing a wording file.',
      );
      return;
    }
    const attempt = wordingEpoch.current.begin();
    try {
      if (file.size > 256 * 1024)
        throw new Error('The file exceeds the supported byte limit.');
      const parsed = parsePersonalVocabulary(await file.arrayBuffer());
      if (!wordingEpoch.current.isCurrent(attempt)) return;
      const encrypted = await encryptLocalValue(
        JSON.stringify(parsed),
        localKey,
      );
      if (!wordingEpoch.current.isCurrent(attempt)) return;
      window.localStorage.setItem(
        'wl.privateVocabulary.encrypted',
        JSON.stringify(encrypted),
      );
      setPrivateVocabulary(parsed);
      setFileState(
        'Private wording loaded locally. The source name and path were not retained.',
      );
    } catch (error) {
      if (!wordingEpoch.current.isCurrent(attempt)) return;
      setFileState(
        error instanceof Error
          ? `File rejected: ${error.message}`
          : 'File rejected: use the supported version-1 structure and bounded string entries.',
      );
    }
  }

  function clearVocabulary() {
    wordingEpoch.current.invalidate();
    if (fileRef.current) fileRef.current.value = '';
    setPrivateVocabulary(null);
    setAtlasOpen(false);
    setAtlasQuery('');
    setAtlasSearch({ ...defaultSearchConfig });
    try {
      window.localStorage.removeItem('wl.privateVocabulary.encrypted');
    } catch {
      lockPrivateProfile();
      setFileState(
        'Local storage could not be cleared. This profile is locked; clear browser storage to remove the retained cache.',
      );
      return;
    }
    setFileState('No private wording file loaded. Original wording is active.');
  }
  const modes: Array<[string, boolean, (value: boolean) => void]> = [
    ['Focus', focus, setFocus],
    ['Low stimulation', lowStim, setLowStim],
    ['Time awareness', timeAware, setTimeAware],
    ['One thing at a time', oneThing, setOneThing],
    ['Momentum', momentum, setMomentum],
  ];
  const atlasEntries = useMemo(
    () =>
      Object.entries(privateVocabulary?.entries ?? {}).filter(([key, value]) =>
        `${key} ${value}`.toLowerCase().includes(atlasQuery.toLowerCase()),
      ),
    [atlasQuery, privateVocabulary],
  );
  const atlasPages = Math.max(1, Math.ceil(atlasEntries.length / 50));
  const visibleAtlasEntries = atlasEntries.slice(
    atlasPage * 50,
    atlasPage * 50 + 50,
  );
  const showSetting = (text: string) => matchesSearch(text, query, search);
  const schoolCard = (
    <section className="surface-card settings-card private-settings">
      <div className="settings-title">
        <ShieldCheck size={21} />
        <div>
          <h2>{schoolName}</h2>
          <p>{schoolMessage}</p>
        </div>
      </div>
      <label htmlFor="school-display-name">
        Display name
        <Input
          id="school-display-name"
          value={schoolName}
          onChange={(event) =>
            setSchoolName(event.target.value.slice(0, 80) || 'School mode')
          }
        />
      </label>
      <label htmlFor="school-unlock-value">
        Local unlock value
        <Input
          id="school-unlock-value"
          type="password"
          autoComplete="current-password"
          value={schoolUnlock}
          onChange={(event) => setSchoolUnlock(event.target.value)}
        />
      </label>
      <div className="button-row">
        {schoolEnabled ? (
          <Button onClick={disableSchoolMode}>Unlock and turn off</Button>
        ) : (
          <Button onClick={enableSchoolMode}>
            {schoolCredential ? 'Turn on' : 'Create unlock and turn on'}
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => {
            setSchoolCredential(null);
            setSchoolEnabled(false);
            setSchoolUnlock('');
            setSchoolMessage('The local unlock was reset.');
          }}
        >
          Reset local unlock
        </Button>
      </div>
      <small>
        Clearing this site’s local storage resets the mode. It does not protect
        sensitive data.
      </small>
    </section>
  );

  if (schoolEnabled) return <div className="settings-grid">{schoolCard}</div>;

  return (
    <div className="settings-grid">
      {showSetting('school mode rename unlock credential') && schoolCard}
      {showSetting('language tone emoji English Cantonese bilingual') && (
        <section className="surface-card settings-card">
          <div className="settings-title">
            <Languages size={21} />
            <div>
              <h2>Language and tone</h2>
              <p>Tone changes style, never facts.</p>
            </div>
          </div>
          <label htmlFor="language-mode">
            Language mode
            <select
              id="language-mode"
              value={language}
              onChange={(event) =>
                setLanguage(event.target.value as LanguageMode)
              }
            >
              {['English', 'Cantonese', 'Bilingual'].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label htmlFor="english-tone">
            English tone: {englishTone}
            <Slider
              id="english-tone"
              min={1}
              max={5}
              step={1}
              value={[englishTone]}
              onValueChange={(value) =>
                setEnglishTone(sliderNumber(value, englishTone))
              }
            />
          </label>
          <label htmlFor="cantonese-tone">
            Cantonese tone: {cantoneseTone}
            <Slider
              id="cantonese-tone"
              min={1}
              max={5}
              step={1}
              value={[cantoneseTone]}
              onValueChange={(value) =>
                setCantoneseTone(sliderNumber(value, cantoneseTone))
              }
            />
          </label>
          <label className="control-line" htmlFor="dialog-emoji">
            <Switch
              id="dialog-emoji"
              checked={emoji}
              onCheckedChange={setEmoji}
            />{' '}
            Show emojis in dialogs and message boxes
          </label>
        </section>
      )}
      {showSetting(
        'private wording local file upload replace clear reset atlas',
      ) && (
        <section
          className="surface-card settings-card private-settings"
          data-private-content
        >
          <div className="settings-title">
            <Upload size={21} />
            <div>
              <h2>Private wording</h2>
              <p>
                Validated, encrypted, and applied only on this device after
                local unlock.
              </p>
            </div>
          </div>
          <label htmlFor="local-unlock-value">
            Local unlock value
            <Input
              id="local-unlock-value"
              type="password"
              autoComplete="current-password"
              value={unlockValue}
              onChange={(event) => setUnlockValue(event.target.value)}
            />
          </label>
          <div className="button-row">
            {credentialExists ? (
              <Button
                variant="outline"
                onClick={unlockProfile}
                disabled={unlocked}
              >
                {unlocked ? 'Local profile unlocked' : 'Unlock local profile'}
              </Button>
            ) : (
              <Button variant="outline" onClick={createProfile}>
                Create local profile
              </Button>
            )}
            {unlocked && (
              <Button variant="ghost" onClick={lockPrivateProfile}>
                Lock now
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            disabled={!unlocked}
            onChange={(event) => handleVocabulary(event.target.files?.[0])}
            aria-label="Choose a local personal wording JSON file"
          />
          <output>{fileState}</output>
          <div className="button-row">
            <Button
              variant="outline"
              disabled={!unlocked}
              onClick={() => fileRef.current?.click()}
            >
              Choose or replace file
            </Button>
            <Button
              variant="ghost"
              disabled={!privateVocabulary}
              onClick={clearVocabulary}
            >
              Clear and restore
            </Button>
            <Button
              variant="ghost"
              disabled={!privateVocabulary || !unlocked}
              onClick={() => setAtlasOpen((value) => !value)}
            >
              {atlasOpen ? 'Close private atlas' : 'Open private atlas'}
            </Button>
          </div>
          <small>
            Nothing is uploaded, logged, copied, or included in ordinary
            exports. Clear removes the encrypted cache immediately.
          </small>
          {atlasOpen && privateVocabulary && (
            <section
              className="private-atlas"
              aria-label="Private wording atlas"
            >
              <div className="atlas-heading">
                <div>
                  <strong>Private wording atlas</strong>
                  <span>{atlasEntries.length} local entries</span>
                </div>
                <SearchWorkbench
                  scope="private-atlas"
                  query={atlasQuery}
                  onQuery={(value) => {
                    setAtlasQuery(value);
                    setAtlasPage(0);
                  }}
                  config={atlasSearch}
                  onConfig={setAtlasSearch}
                />
              </div>
              <div className="atlas-list">
                {visibleAtlasEntries.map(([key, value]) => (
                  <div className="atlas-row" key={key}>
                    <span>{key}</span>
                    <strong>{value || 'Empty replacement'}</strong>
                  </div>
                ))}
              </div>
              <div className="atlas-pagination">
                <Button
                  variant="outline"
                  disabled={atlasPage === 0}
                  onClick={() =>
                    setAtlasPage((value) => Math.max(0, value - 1))
                  }
                >
                  Previous
                </Button>
                <span>
                  Page {atlasPage + 1} of {atlasPages}
                </span>
                <Button
                  variant="outline"
                  disabled={atlasPage + 1 >= atlasPages}
                  onClick={() =>
                    setAtlasPage((value) => Math.min(atlasPages - 1, value + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </section>
          )}
        </section>
      )}
      {showSetting('appearance theme density accent color editor') && (
        <section className="surface-card settings-card">
          <div className="settings-title">
            <Palette size={21} />
            <div>
              <h2>Appearance</h2>
              <p>Current values come from built-in defaults.</p>
            </div>
          </div>
          <label htmlFor="site-theme">
            Theme
            <select
              id="site-theme"
              value={dark ? 'Dark' : 'Light'}
              onChange={(event) => setDark(event.target.value === 'Dark')}
            >
              <option>Light</option>
              <option>Dark</option>
            </select>
          </label>
          <label htmlFor="site-density">
            Density
            <select
              id="site-density"
              value={density}
              onChange={(event) => setDensity(event.target.value)}
            >
              <option>Compact</option>
              <option>Comfortable</option>
              <option>Spacious</option>
            </select>
          </label>
          <label htmlFor="site-accent">
            Accent color
            <input
              id="site-accent"
              type="color"
              value={accent}
              onChange={(event) => setAccent(event.target.value)}
            />
          </label>
          <Button
            variant="outline"
            onClick={() =>
              notify('Appearance settings are active on this page.')
            }
          >
            Apply and preview appearance
          </Button>
        </section>
      )}
      {showSetting(
        'attention focus low stimulation time awareness one thing momentum',
      ) && (
        <section className="surface-card settings-card">
          <div className="settings-title">
            <Gauge size={21} />
            <div>
              <h2>Attention support</h2>
              <p>Each mode is independent and off by default.</p>
            </div>
          </div>
          {modes.map(([label, value, setter]) => {
            const id = `attention-${label.toLowerCase().replaceAll(' ', '-')}`;
            return (
              <label className="control-line" htmlFor={id} key={label}>
                <Switch id={id} checked={value} onCheckedChange={setter} />{' '}
                {label}
              </label>
            );
          })}
        </section>
      )}
      {showSetting(
        'security recovery element locks authenticator history support',
      ) && (
        <section className="surface-card settings-card">
          <div className="settings-title">
            <KeyRound size={21} />
            <div>
              <h2>Security and recovery</h2>
              <p>
                Novelty locks are speed bumps, not protection or encryption.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setToolPanel('locks')}>
            <LockKeyhole size={17} /> Manage element locks
          </Button>
          <Button
            variant="outline"
            onClick={() => setToolPanel('authenticator')}
          >
            <ShieldCheck size={17} /> Open authenticator
          </Button>
          <Button variant="outline" onClick={() => setToolPanel('history')}>
            <History size={17} /> Open local history
          </Button>
          {toolPanel && (
            <div className="private-atlas" aria-live="polite">
              <strong>
                {toolPanel === 'locks'
                  ? 'Element locks'
                  : toolPanel === 'authenticator'
                    ? 'Authenticator'
                    : 'Local history'}
              </strong>
              <p>
                {toolPanel === 'locks'
                  ? 'Site-local novelty locks are browser-storage speed bumps. Clear this site’s storage to recover.'
                  : toolPanel === 'authenticator'
                    ? 'Authenticator entries stay in local browser storage. No network request is made.'
                    : 'Settings changes are listed locally and private wording values are omitted.'}
              </p>
              <div className="button-row">
                <Button
                  variant="outline"
                  onClick={() => setTab('documentation', true)}
                >
                  Read the complete article
                </Button>
                <Button variant="ghost" onClick={() => setToolPanel(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
      {showSetting('narration voice speech rate pitch schedule settings') && (
        <section className="surface-card settings-card">
          <div className="settings-title">
            <Sparkles size={21} />
            <div>
              <h2>Narration and schedules</h2>
              <p>Narration is off until enabled.</p>
            </div>
          </div>
          <label className="control-line" htmlFor="narration-enabled">
            <Switch
              id="narration-enabled"
              checked={narration}
              onCheckedChange={setNarration}
            />{' '}
            Enable narration
          </label>
          <label htmlFor="english-voice">
            English voice
            <select
              id="english-voice"
              value={englishVoice}
              onChange={(event) => setEnglishVoice(event.target.value)}
            >
              <option value="auto">Choose automatically</option>
              {voices
                .filter((voice) =>
                  voice.lang.toLocaleLowerCase().startsWith('en'),
                )
                .map((voice) => (
                  <option value={voice.voiceURI} key={voice.voiceURI}>
                    {voice.name} · {voice.lang}
                  </option>
                ))}
            </select>
          </label>
          <label htmlFor="cantonese-voice">
            Cantonese voice
            <select
              id="cantonese-voice"
              value={cantoneseVoice}
              onChange={(event) => setCantoneseVoice(event.target.value)}
            >
              <option value="auto">Choose automatically</option>
              {voices
                .filter((voice) => /^zh-(hk|hant)/i.test(voice.lang))
                .map((voice) => (
                  <option value={voice.voiceURI} key={voice.voiceURI}>
                    {voice.name} · {voice.lang}
                  </option>
                ))}
            </select>
          </label>
          <label htmlFor="speech-rate">
            Rate: {speechRate.toFixed(1)}
            <input
              id="speech-rate"
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={speechRate}
              onChange={(event) => setSpeechRate(Number(event.target.value))}
            />
          </label>
          <label htmlFor="speech-pitch">
            Pitch: {speechPitch.toFixed(1)}
            <input
              id="speech-pitch"
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={speechPitch}
              onChange={(event) => setSpeechPitch(Number(event.target.value))}
            />
          </label>
          <div className="button-row">
            <Button
              variant="outline"
              disabled={
                !narration ||
                typeof window === 'undefined' ||
                !('speechSynthesis' in window)
              }
              onClick={() => {
                const utterance = new SpeechSynthesisUtterance(
                  'Wording Lens narration preview.',
                );
                utterance.rate = speechRate;
                utterance.pitch = speechPitch;
                const selected = voices.find(
                  (voice) => voice.voiceURI === englishVoice,
                );
                if (selected) utterance.voice = selected;
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(utterance);
              }}
            >
              Preview narration
            </Button>
            <Button
              variant="outline"
              onClick={() => setScheduleOpen((value) => !value)}
            >
              Edit scheduled settings
            </Button>
          </div>
          {scheduleOpen && (
            <div className="private-atlas">
              <strong>Local schedule window</strong>
              <label htmlFor="schedule-start">
                Start time
                <input
                  id="schedule-start"
                  type="time"
                  value={scheduleStart}
                  onChange={(event) => setScheduleStart(event.target.value)}
                />
              </label>
              <label htmlFor="schedule-end">
                End time
                <input
                  id="schedule-end"
                  type="time"
                  value={scheduleEnd}
                  onChange={(event) => setScheduleEnd(event.target.value)}
                />
              </label>
              <small>
                Times use the browser’s local timezone. Equal start and end
                means the rule is inactive.
              </small>
            </div>
          )}
        </section>
      )}
      {query &&
        ![
          'language tone emoji English Cantonese bilingual',
          'private wording local file upload replace clear reset atlas',
          'appearance theme density accent color editor',
          'attention focus low stimulation time awareness one thing momentum',
          'security recovery element locks authenticator history support',
          'narration voice speech rate pitch schedule settings',
        ].some((text) => showSetting(text)) && <NoMatches query={query} />}
    </div>
  );
}

type SiteContextState = {
  x: number;
  y: number;
  key: string;
  label: string;
  target: HTMLElement;
  containsPrivateContent: boolean;
};

function markElementLock(target: HTMLElement, locked: boolean) {
  if (locked) {
    target.dataset.localLock = 'true';
    target.setAttribute('aria-disabled', 'true');
  } else {
    delete target.dataset.localLock;
    target.removeAttribute('aria-disabled');
  }
}

function applyElementAppearance(
  target: HTMLElement,
  color: string,
  radius: number,
) {
  target.style.outline = `3px solid ${color}`;
  target.style.borderRadius = `${radius}px`;
}

function SiteContextMenu({
  context,
  close,
  notify,
}: {
  context: SiteContextState;
  close: () => void;
  notify: (message: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchConfig>({
    ...defaultSearchConfig,
  });
  const [mode, setMode] = useState<'menu' | 'appearance' | 'lock'>('menu');
  const [color, setColor] = useState('#4fcfff');
  const [radius, setRadius] = useState(12);
  const [credential, setCredential] = useState('');
  const [policy, setPolicy] = useState('PIN');
  const [message, setMessage] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const lockKey = `wl.element-lock.${context.key}`;
  const isLocked =
    context.target.dataset.localLock === 'true' ||
    window.localStorage.getItem(lockKey) !== null;
  const actions = [
    { id: 'appearance', label: 'Edit appearance…' },
    {
      id: 'lock',
      label: isLocked ? 'Unlock this element…' : 'Lock this element…',
    },
    { id: 'export', label: 'Export element description' },
  ].filter((action) => matchesSearch(action.label, query, search));

  useEffect(() => {
    menuRef.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, []);

  async function saveLock() {
    try {
      const created = await createLocalCredential(credential);
      window.localStorage.setItem(
        lockKey,
        JSON.stringify({ policy, record: created.record }),
      );
      created.key.fill(0);
      markElementLock(context.target, true);
      setCredential('');
      setMessage(`${context.label} is locally locked.`);
      notify(`${context.label} was locally locked.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'The local lock could not be created.',
      );
    }
  }

  async function removeLock() {
    try {
      const raw = window.localStorage.getItem(lockKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as { record?: LocalCredentialRecord };
      if (!saved.record) throw new Error('The local lock record is invalid.');
      const key = await unlockLocalCredential(credential, saved.record);
      if (!key) {
        setMessage('The local unlock value did not match.');
        return;
      }
      key.fill(0);
      window.localStorage.removeItem(lockKey);
      markElementLock(context.target, false);
      setCredential('');
      setMessage(`${context.label} is unlocked.`);
      notify(`${context.label} was unlocked.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'The local lock could not be removed.',
      );
    }
  }

  return (
    <div
      ref={menuRef}
      className="site-context-menu"
      style={{ left: context.x, top: context.y }}
      role="menu"
      aria-label={`Actions for ${context.label}`}
    >
      <div className="panel-title">
        <strong>{context.label}</strong>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close element actions"
          onClick={close}
        >
          <X size={17} />
        </Button>
      </div>
      {mode === 'menu' && (
        <>
          <SearchWorkbench
            scope="element-menu"
            query={query}
            onQuery={setQuery}
            config={search}
            onConfig={setSearch}
          />
          {actions.map((action) => (
            <button
              type="button"
              role="menuitem"
              key={action.id}
              disabled={
                action.id === 'export' && context.containsPrivateContent
              }
              onClick={() => {
                if (action.id === 'export') {
                  if (context.containsPrivateContent) return;
                  downloadText(
                    'wording-lens-element.json',
                    JSON.stringify(
                      { schemaVersion: 1, element: context.label },
                      null,
                      2,
                    ),
                  );
                  notify('Element description exported locally.');
                  close();
                } else setMode(action.id as 'appearance' | 'lock');
              }}
            >
              {action.label}
            </button>
          ))}
          {context.containsPrivateContent && (
            <p>
              Private wording and file information are excluded from element
              exports.
            </p>
          )}
          {actions.length === 0 && <p className="muted">No matching action.</p>}
        </>
      )}
      {mode === 'appearance' && (
        <div className="context-editor">
          <label htmlFor="element-color">
            Outline color
            <input
              id="element-color"
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
            />
          </label>
          <label htmlFor="element-radius">
            Corner radius: {radius}px
            <input
              id="element-radius"
              type="range"
              min="0"
              max="40"
              value={radius}
              onChange={(event) => setRadius(Number(event.target.value))}
            />
          </label>
          <div className="button-row">
            <Button
              onClick={() => {
                applyElementAppearance(context.target, color, radius);
                window.localStorage.setItem(
                  `wl.element-appearance.${context.key}`,
                  JSON.stringify({ color, radius }),
                );
                notify(`Appearance updated for ${context.label}.`);
                close();
              }}
            >
              Apply locally
            </Button>
            <Button variant="ghost" onClick={() => setMode('menu')}>
              Back
            </Button>
          </div>
        </div>
      )}
      {mode === 'lock' && (
        <div className="context-editor">
          <p>
            This is a local interface speed bump, not protection. Clear this
            site’s storage to recover.
          </p>
          {!isLocked && (
            <label htmlFor="element-lock-policy">
              Policy
              <select
                id="element-lock-policy"
                value={policy}
                onChange={(event) => setPolicy(event.target.value)}
              >
                <option>PIN</option>
                <option>Password</option>
                <option>PIN plus password</option>
                <option>Password plus TOTP</option>
                <option>PIN plus TOTP</option>
                <option>Password plus PIN plus TOTP</option>
              </select>
            </label>
          )}
          <label htmlFor="element-lock-value">
            Local unlock value
            <Input
              id="element-lock-value"
              type="password"
              value={credential}
              onChange={(event) => setCredential(event.target.value)}
            />
          </label>
          {message && <output>{message}</output>}
          <div className="button-row">
            <Button onClick={isLocked ? removeLock : saveLock}>
              {isLocked ? 'Unlock locally' : 'Create local lock'}
            </Button>
            <Button variant="ghost" onClick={() => setMode('menu')}>
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const emptySearchByTab = (): Record<TabId, SearchConfig> =>
  Object.fromEntries(
    navigation.map(({ id }) => [id, { ...defaultSearchConfig }]),
  ) as Record<TabId, SearchConfig>;

export default function HomePage() {
  const [tab, setTab] = useStoredState<TabId>('wl.tab', 'home');
  const [queryByTab, setQueryByTab] = useState<Record<TabId, string>>(
    () =>
      Object.fromEntries(navigation.map(({ id }) => [id, ''])) as Record<
        TabId,
        string
      >,
  );
  const [searchByTab, setSearchByTab] = useState(emptySearchByTab);
  const [dark, setDark] = useStoredState('wl.dark', true);
  const [language] = useStoredState<LanguageMode>('wl.language', 'English');
  const [englishTone] = useStoredState('wl.tone.en', 5);
  const [cantoneseTone] = useStoredState('wl.tone.zh', 5);
  const [schoolEnabled, setSchoolEnabled] = useStoredState(
    'wl.school.enabled',
    false,
  );
  const [focusMode] = useStoredState('wl.focus', false);
  const [lowStim] = useStoredState('wl.lowStim', false);
  const [timeAware] = useStoredState('wl.timeAware', false);
  const [oneThing] = useStoredState('wl.oneThing', false);
  const [momentum] = useStoredState('wl.momentum', false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionStarted] = useState(() => Date.now());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [notices, setNotices] = useState<string[]>([]);
  const [context, setContext] = useState<SiteContextState | null>(null);
  const contextOpener = useRef<HTMLElement | null>(null);
  const tabRefs = useRef(new Map<TabId, HTMLButtonElement>());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const paletteRef = useRef<HTMLDialogElement>(null);
  const paletteOpener = useRef<HTMLElement | null>(null);
  const query = queryByTab[tab];
  const search = searchByTab[tab];
  const notify = useCallback((message: string) => {
    setNotices((current) => [message, ...current].slice(0, 12));
  }, []);
  const openContext = useCallback((target: HTMLElement, x = 16, y = 96) => {
    const actionable =
      target.closest<HTMLElement>(
        'button, input, select, textarea, a, [data-element-id], section, article, header, footer',
      ) ?? target;
    const { key, label, containsPrivateContent } = describeElement(actionable);
    contextOpener.current = actionable;
    try {
      const appearance = JSON.parse(
        window.localStorage.getItem(`wl.element-appearance.${key}`) ?? 'null',
      ) as { color?: string; radius?: number } | null;
      if (appearance?.color)
        actionable.style.outline = `3px solid ${appearance.color}`;
      if (Number.isFinite(appearance?.radius))
        actionable.style.borderRadius = `${appearance?.radius}px`;
      if (window.localStorage.getItem(`wl.element-lock.${key}`)) {
        actionable.dataset.localLock = 'true';
        actionable.setAttribute('aria-disabled', 'true');
      }
    } catch {
      /* invalid optional appearance data is ignored */
    }
    setContext({
      x: Math.max(8, Math.min(x, window.innerWidth - 340)),
      y: Math.max(72, Math.min(y, window.innerHeight - 440)),
      key,
      label,
      target: actionable,
      containsPrivateContent,
    });
  }, []);
  const closeContext = useCallback(() => {
    setContext(null);
    requestAnimationFrame(() => contextOpener.current?.focus());
  }, []);
  const chooseTab = useCallback(
    (next: TabId, focusHeading = false) => {
      setTab(next);
      if (focusHeading)
        requestAnimationFrame(() => headingRef.current?.focus());
    },
    [setTab],
  );
  const closePalette = useCallback(() => {
    if (paletteRef.current?.open) paletteRef.current.close();
    setPaletteOpen(false);
    requestAnimationFrame(() => paletteOpener.current?.focus());
  }, []);
  const openPalette = useCallback(() => {
    paletteOpener.current = document.activeElement as HTMLElement | null;
    setPaletteQuery('');
    setPaletteOpen(true);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
  useEffect(() => {
    document.documentElement.dataset.language = schoolEnabled
      ? 'english'
      : language.toLocaleLowerCase();
    document.documentElement.dataset.focusMode = String(focusMode);
    document.documentElement.dataset.lowStimulation = String(lowStim);
    document.documentElement.lang =
      schoolEnabled || language === 'English' ? 'en' : 'zh-Hant';
  }, [focusMode, language, lowStim, schoolEnabled]);
  useEffect(() => {
    if (!timeAware) return;
    const update = () =>
      setElapsedSeconds(Math.floor((Date.now() - sessionStarted) / 1000));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [sessionStarted, timeAware]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        openPalette();
      }
      if (event.shiftKey && event.key === 'F10') {
        event.preventDefault();
        openContext(
          (document.activeElement as HTMLElement | null) ?? document.body,
        );
      }
      if (event.key === 'Escape' && context) closeContext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeContext, context, openContext, openPalette]);
  useEffect(() => {
    if (paletteOpen && paletteRef.current && !paletteRef.current.open)
      paletteRef.current.showModal();
  }, [paletteOpen]);
  const activeNavigation =
    navigation.find((item) => item.id === tab) ?? navigation[0];
  const title =
    schoolEnabled || language === 'English'
      ? activeNavigation.label
      : language === 'Cantonese'
        ? activeNavigation.zh
        : `${activeNavigation.label} · ${activeNavigation.zh}`;
  const labelFor = (entry: (typeof navigation)[number]) =>
    schoolEnabled || language === 'English'
      ? entry.label
      : language === 'Cantonese'
        ? entry.zh
        : `${entry.label} · ${entry.zh}`;
  const paletteEntries = [
    ...navigation.map((item) => ({ ...item, detail: `Open ${item.label}` })),
    {
      id: 'settings' as const,
      label: 'Personal wording',
      icon: Upload,
      detail: 'Open the local wording controls',
    },
    {
      id: 'settings' as const,
      label: 'Appearance editor',
      icon: Palette,
      detail: 'Open site appearance controls',
    },
    {
      id: 'settings' as const,
      label: 'Narration and schedules',
      icon: Sparkles,
      detail: 'Open narration and scheduled settings',
    },
  ].filter((entry) =>
    `${entry.label} ${entry.detail}`
      .toLocaleLowerCase()
      .includes(paletteQuery.toLocaleLowerCase()),
  );
  function onTabKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    id: TabId,
  ) {
    const index = navigation.findIndex((item) => item.id === id);
    let nextIndex = index;
    if (event.key === 'ArrowDown') nextIndex = (index + 1) % navigation.length;
    else if (event.key === 'ArrowUp')
      nextIndex = (index - 1 + navigation.length) % navigation.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = navigation.length - 1;
    else return;
    event.preventDefault();
    const next = navigation[nextIndex].id;
    chooseTab(next);
    tabRefs.current.get(next)?.focus();
  }
  return (
    <div
      className="app-shell"
      onContextMenu={(event) => {
        event.preventDefault();
        openContext(event.target as HTMLElement, event.clientX, event.clientY);
      }}
      onClickCapture={(event) => {
        const locked = (event.target as HTMLElement).closest<HTMLElement>(
          '[data-local-lock="true"]',
        );
        if (!locked || locked.closest('.site-context-menu')) return;
        event.preventDefault();
        event.stopPropagation();
        openContext(locked, 16, 96);
        notify(`${describeElement(locked).label} is locally locked.`);
      }}
    >
      <header className="top-bar" data-element-id="top-bar">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
        </div>
        <div className="brand-copy">
          <strong>Wording Lens</strong>
          <span>Operations cockpit</span>
        </div>
        <div className="provenance">
          <span>Version {SITE_PROVENANCE.version || 'Unavailable'}</span>
          <span>
            Updated{' '}
            {SITE_PROVENANCE.updatedAt
              ? new Date(SITE_PROVENANCE.updatedAt).toLocaleString(undefined, {
                  timeZoneName: 'short',
                })
              : 'Unavailable'}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDark((value) => !value)}
          aria-label={dark ? 'Use light theme' : 'Use dark theme'}
        >
          {dark ? <Sun size={19} /> : <Moon size={19} />}
        </Button>
        <Button variant="ghost" onClick={openPalette}>
          <Command size={18} />
          <kbd>Ctrl Shift F</kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open actions for the focused element"
          onClick={() =>
            openContext(
              (document.activeElement as HTMLElement | null) ?? document.body,
            )
          }
        >
          <Settings size={19} />
        </Button>
      </header>
      <div
        className="tab-rail"
        role="tablist"
        aria-label="Primary"
        aria-orientation="vertical"
      >
        <div className="rail-logo" role="presentation">
          <LayoutDashboard aria-hidden="true" size={22} />
        </div>
        {navigation.map((entry) => {
          const { id, icon: Icon } = entry;
          const label = labelFor(entry);
          return (
            <button
              id={`tab-${id}`}
              role="tab"
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              className={tab === id ? 'active' : ''}
              ref={(node) => {
                if (node) tabRefs.current.set(id, node);
                else tabRefs.current.delete(id);
              }}
              onKeyDown={(event) => onTabKeyDown(event, id)}
              onClick={() => chooseTab(id)}
              key={id}
              data-element-id={`primary-tab-${id}`}
            >
              <Icon aria-hidden="true" size={20} />
              <span>{label}</span>
            </button>
          );
        })}
        <div className="rail-spacer" role="presentation" />
      </div>
      <main className="workspace" data-element-id={`workspace-${tab}`}>
        <div className="workspace-heading">
          <div>
            <span className="kicker">WORDING LENS</span>
            <h1 ref={headingRef} tabIndex={-1}>
              {title}
            </h1>
          </div>
          <StatusPill tone="active">Preview build</StatusPill>
        </div>
        <SearchWorkbench
          scope={tab}
          query={query}
          onQuery={(value) =>
            setQueryByTab((current) => ({ ...current, [tab]: value }))
          }
          config={search}
          onConfig={(next) =>
            setSearchByTab((current) => ({
              ...current,
              [tab]: typeof next === 'function' ? next(current[tab]) : next,
            }))
          }
        />
        <section
          className="panel-content"
          id={`panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
        >
          {schoolEnabled && tab !== 'settings' ? (
            <section className="surface-card school-panel">
              <h2>School mode is active</h2>
              <p>
                This surface uses English presentation. Optional language, tone,
                private wording, and food-surprise controls are absent until the
                local mode is unlocked.
              </p>
              <Button onClick={() => chooseTab('settings', true)}>
                Open the unlock control
              </Button>
            </section>
          ) : (
            <>
              {tab === 'home' && (
                <HomePanel setTab={chooseTab} query={query} search={search} />
              )}
              {tab === 'operations' && (
                <OperationsPanel
                  query={query}
                  search={search}
                  notify={notify}
                />
              )}
              {tab === 'features' && (
                <FeaturesPanel query={query} search={search} />
              )}
              {tab === 'documentation' && (
                <DocumentationPanel query={query} search={search} />
              )}
              {tab === 'status' && (
                <StatusPanel query={query} search={search} />
              )}
              {tab === 'downloads' && (
                <DownloadsPanel query={query} search={search} />
              )}
            </>
          )}
          {tab === 'settings' && (
            <SettingsPanel
              dark={dark}
              setDark={setDark}
              notify={notify}
              setTab={chooseTab}
              query={query}
              search={search}
              schoolEnabled={schoolEnabled}
              setSchoolEnabled={setSchoolEnabled}
            />
          )}
        </section>
      </main>
      <footer className="bottom-status">
        <span>
          <span className="status-dot" /> Local workspace ready
        </span>
        <span>
          This documentation surface is not the installed application.
        </span>
        {timeAware && <span>Session open {elapsedSeconds} seconds</span>}
        {oneThing && <span>Current next action: review one surface</span>}
        {momentum && elapsedSeconds > 120 && (
          <span>Nothing has changed here for {elapsedSeconds} seconds.</span>
        )}
        <span>
          {englishTone === 1 && cantoneseTone === 1
            ? 'Ready.'
            : 'Ready. Every control should earn its pixels.'}
        </span>
      </footer>
      {paletteOpen && (
        <div className="palette-backdrop" role="presentation">
          <dialog
            ref={paletteRef}
            className="command-palette"
            aria-label="Command palette"
            onCancel={(event) => {
              event.preventDefault();
              closePalette();
            }}
            onClose={() => setPaletteOpen(false)}
          >
            <div className="palette-search">
              <Search size={18} />
              <Input
                autoFocus
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
                placeholder="Find a command, page, setting, or control"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={closePalette}
                aria-label="Close command palette"
              >
                <X size={18} />
              </Button>
            </div>
            {paletteEntries.map(({ id, label, icon: Icon, detail }) => (
              <button
                key={`${id}-${label}`}
                onClick={() => {
                  chooseTab(id, true);
                  closePalette();
                }}
              >
                <Icon size={18} />
                <span>
                  {label}
                  <small>{detail}</small>
                </span>
                <kbd>Enter</kbd>
              </button>
            ))}
            {paletteEntries.length === 0 && (
              <p className="muted">No matching command.</p>
            )}
          </dialog>
        </div>
      )}
      {notices[0] && (
        <aside className="site-toast" aria-live="polite">
          <span>{notices[0]}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Dismiss notification"
            onClick={() => setNotices((current) => current.slice(1))}
          >
            <X size={18} />
          </Button>
        </aside>
      )}
      {context && (
        <SiteContextMenu
          context={context}
          close={closeContext}
          notify={notify}
        />
      )}
    </div>
  );
}
