'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

type TabId =
  | 'home'
  | 'operations'
  | 'features'
  | 'documentation'
  | 'status'
  | 'downloads'
  | 'settings';
type LanguageMode = 'English' | 'Cantonese' | 'Bilingual';

const navigation: Array<{ id: TabId; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'operations', label: 'Operations', icon: Workflow },
  { id: 'features', label: 'Features', icon: Boxes },
  { id: 'documentation', label: 'Documentation', icon: FileText },
  { id: 'status', label: 'Status', icon: Activity },
  { id: 'downloads', label: 'Downloads', icon: Download },
  { id: 'settings', label: 'Settings', icon: Settings },
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

function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const loaded = useRef(false);
  useEffect(() => {
    const stored = window.localStorage.getItem(key);
    if (!stored) {
      loaded.current = true;
      window.localStorage.setItem(key, JSON.stringify(initial));
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
      loaded.current = true;
    });
    return () => {
      active = false;
    };
  }, [initial, key]);
  useEffect(() => {
    if (loaded.current) window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}

function sliderNumber(
  value: number | readonly number[],
  fallback: number,
): number {
  return typeof value === 'number' ? value : (value[0] ?? fallback);
}

function SearchWorkbench({
  query,
  onQuery,
}: {
  query: string;
  onQuery: (value: string) => void;
}) {
  const [regex, setRegex] = useState(false);
  const [builder, setBuilder] = useState(false);
  const [flags, setFlags] = useState('i');
  const valid = useMemo(() => {
    if (!regex || !query) return true;
    try {
      new RegExp(query, flags);
      return true;
    } catch {
      return false;
    }
  }, [flags, query, regex]);
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
          variant={builder ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setBuilder((value) => !value)}
          aria-expanded={builder}
          aria-label="Open regular expression builder"
        >
          <Braces aria-hidden="true" size={18} /> Builder
        </Button>
      </div>
      {builder && (
        <section
          className="regex-panel"
          aria-label="Regular expression builder"
        >
          <div>
            <strong>Regular-expression workbench</strong>
            <p>Plain text stays active until you enable the pattern.</p>
          </div>
          <label className="control-line" htmlFor="page-search-regex">
            <Switch
              id="page-search-regex"
              checked={regex}
              onCheckedChange={setRegex}
            />{' '}
            Use regular expression
          </label>
          <label htmlFor="page-search-flags">
            Flags
            <Input
              id="page-search-flags"
              aria-label="Regular expression flags"
              value={flags}
              onChange={(event) =>
                setFlags(event.target.value.replace(/[^dgimsuvy]/g, ''))
              }
            />
          </label>
          <output className={valid ? 'valid' : 'invalid'}>
            {valid
              ? 'Pattern is valid.'
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

function HomePanel({ setTab }: { setTab: (tab: TabId) => void }) {
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
          {operationCards.map(({ icon: Icon, title, detail, state, tone }) => (
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
        <Button variant="outline">Choose project</Button>
      </section>
    </div>
  );
}

function OperationsPanel() {
  const [selected, setSelected] = useState<string[]>([]);
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
        <Button>
          <Play aria-hidden="true" size={18} /> New operation
        </Button>
      </section>
      {selected.length > 0 && (
        <div className="selection-bar">
          <strong>{selected.length} selected</strong>
          <Button variant="outline">Export selection</Button>
          <Button variant="outline" onClick={() => setSelected([])}>
            Clear
          </Button>
        </div>
      )}
      <section
        className="surface-card table-card"
        aria-label="Available operations"
      >
        <div className="table-row table-head">
          <span>Select</span>
          <span>Action</span>
          <span>Adapter</span>
          <span>Impact</span>
          <span>State</span>
        </div>
        {operationRows.map(([name, adapter, impact, state]) => (
          <div className="table-row" key={name}>
            <input
              type="checkbox"
              aria-label={`Select ${name}`}
              checked={selected.includes(name)}
              onChange={() => toggle(name)}
            />
            <strong>{name}</strong>
            <span>{adapter}</span>
            <span>{impact}</span>
            <StatusPill tone={state === 'Ready' ? 'good' : 'quiet'}>
              {state}
            </StatusPill>
          </div>
        ))}
      </section>
    </div>
  );
}

function FeaturesPanel({ query }: { query: string }) {
  const filtered = featureGroups.filter(([title, detail]) =>
    `${title} ${detail}`.toLowerCase().includes(query.toLowerCase()),
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
    </div>
  );
}

function DocumentationPanel({ query }: { query: string }) {
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
  return (
    <div className="docs-layout">
      <aside className="surface-card docs-list">
        {articles
          .filter((x) => x.toLowerCase().includes(query.toLowerCase()))
          .map((article, index) => (
            <button className={index === 0 ? 'active' : ''} key={article}>
              {article}
              <ChevronRight aria-hidden="true" size={16} />
            </button>
          ))}
      </aside>
      <article className="surface-card article">
        <span className="kicker">GETTING STARTED</span>
        <h2>Begin with a truthful empty workspace</h2>
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
          <button>Operation adapters</button>
          <button>Safety and recovery</button>
          <button>Private wording file</button>
        </div>
      </article>
    </div>
  );
}

function StatusPanel() {
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

function DownloadsPanel() {
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

function SettingsPanel() {
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
  const fileRef = useRef<HTMLInputElement>(null);
  const wordingAttemptRef = useRef(0);

  useEffect(() => {
    queueMicrotask(() =>
      setCredentialExists(
        window.localStorage.getItem('wl.localCredential') !== null,
      ),
    );
  }, []);

  useEffect(() => {
    if (!localKey) return;
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
        setPrivateVocabulary(parsed);
        setFileState(
          'Private wording loaded locally from the validated encrypted cache.',
        );
      } catch {
        window.localStorage.removeItem('wl.privateVocabulary.encrypted');
        setPrivateVocabulary(null);
        setFileState(
          'The local cache was invalid and was cleared. Original wording is active.',
        );
      }
    })();
  }, [localKey]);

  async function createProfile() {
    try {
      const created = await createLocalCredential(unlockValue);
      window.localStorage.setItem(
        'wl.localCredential',
        JSON.stringify(created.record),
      );
      setCredentialExists(true);
      setUnlocked(true);
      setLocalKey(created.key);
      setUnlockValue('');
    } catch (error) {
      setFileState(
        error instanceof Error
          ? error.message
          : 'The local profile could not be created.',
      );
    }
  }

  async function unlockProfile() {
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
      if (!key) {
        setFileState('The local unlock value did not match.');
        return;
      }
      setUnlocked(true);
      setLocalKey(key);
      setUnlockValue('');
    } catch {
      setFileState(
        'The local credential record was invalid. Reset local site data to recover.',
      );
    }
  }

  async function handleVocabulary(file?: File) {
    if (!file) return;
    if (!unlocked || !localKey) {
      setFileState(
        'Unlock the local private profile before choosing a wording file.',
      );
      return;
    }
    const attempt = ++wordingAttemptRef.current;
    try {
      const parsed = parsePersonalVocabulary(await file.arrayBuffer());
      const encrypted = await encryptLocalValue(
        JSON.stringify(parsed),
        localKey,
      );
      if (attempt !== wordingAttemptRef.current) return;
      window.localStorage.setItem(
        'wl.privateVocabulary.encrypted',
        JSON.stringify(encrypted),
      );
      setPrivateVocabulary(parsed);
      setFileState(
        'Private wording loaded locally. The source name and path were not retained.',
      );
    } catch (error) {
      setFileState(
        error instanceof Error
          ? `File rejected: ${error.message}`
          : 'File rejected: use the supported version-1 structure and bounded string entries.',
      );
    }
  }

  function clearVocabulary() {
    wordingAttemptRef.current += 1;
    window.localStorage.removeItem('wl.privateVocabulary.encrypted');
    if (fileRef.current) fileRef.current.value = '';
    setPrivateVocabulary(null);
    setAtlasOpen(false);
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

  return (
    <div className="settings-grid">
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
      <section className="surface-card settings-card private-settings">
        <div className="settings-title">
          <Upload size={21} />
          <div>
            <h2>Private wording</h2>
            <p>
              Validated, encrypted, and applied only on this device after local
              unlock.
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
            <Button
              variant="ghost"
              onClick={() => {
                wordingAttemptRef.current += 1;
                setUnlocked(false);
                setLocalKey(null);
                setPrivateVocabulary(null);
                setAtlasOpen(false);
                setFileState(
                  'Local profile locked. Original wording is active.',
                );
              }}
            >
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
          Nothing is uploaded, logged, copied, or included in ordinary exports.
          Clear removes the encrypted cache immediately.
        </small>
        {atlasOpen && privateVocabulary && (
          <section className="private-atlas" aria-label="Private wording atlas">
            <div className="atlas-heading">
              <div>
                <strong>Private wording atlas</strong>
                <span>{atlasEntries.length} local entries</span>
              </div>
              <Input
                value={atlasQuery}
                onChange={(event) => {
                  setAtlasQuery(event.target.value);
                  setAtlasPage(0);
                }}
                aria-label="Search private wording entries"
                placeholder="Search the private atlas"
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
                onClick={() => setAtlasPage((value) => Math.max(0, value - 1))}
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
      <section className="surface-card settings-card">
        <div className="settings-title">
          <Palette size={21} />
          <div>
            <h2>Appearance</h2>
            <p>Current values come from built-in defaults.</p>
          </div>
        </div>
        <label>
          Theme
          <select defaultValue="System">
            <option>System</option>
            <option>Light</option>
            <option>Dark</option>
          </select>
        </label>
        <label>
          Density
          <select defaultValue="Comfortable">
            <option>Compact</option>
            <option>Comfortable</option>
            <option>Spacious</option>
          </select>
        </label>
        <label>
          Accent color
          <input type="color" defaultValue="#63d8ff" />
        </label>
        <Button variant="outline">Open complete appearance editor</Button>
      </section>
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
      <section className="surface-card settings-card">
        <div className="settings-title">
          <KeyRound size={21} />
          <div>
            <h2>Security and recovery</h2>
            <p>Novelty locks are speed bumps, not protection or encryption.</p>
          </div>
        </div>
        <Button variant="outline">
          <LockKeyhole size={17} /> Manage element locks
        </Button>
        <Button variant="outline">
          <ShieldCheck size={17} /> Open authenticator
        </Button>
        <Button variant="outline">
          <History size={17} /> Open local history
        </Button>
      </section>
      <section className="surface-card settings-card">
        <div className="settings-title">
          <Sparkles size={21} />
          <div>
            <h2>Narration and schedules</h2>
            <p>Narration is off until enabled.</p>
          </div>
        </div>
        <label className="control-line" htmlFor="narration-enabled">
          <Switch id="narration-enabled" /> Enable narration
        </label>
        <label htmlFor="english-voice">
          English voice
          <select id="english-voice">
            <option>Choose automatically</option>
          </select>
        </label>
        <label htmlFor="cantonese-voice">
          Cantonese voice
          <select id="cantonese-voice">
            <option>Choose automatically</option>
          </select>
        </label>
        <Button variant="outline">Edit scheduled settings</Button>
      </section>
    </div>
  );
}

export default function HomePage() {
  const [tab, setTab] = useStoredState<TabId>('wl.tab', 'home');
  const [query, setQuery] = useState('');
  const [dark, setDark] = useStoredState('wl.dark', true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const title = navigation.find((item) => item.id === tab)?.label ?? 'Home';
  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
        </div>
        <div className="brand-copy">
          <strong>Wording Lens</strong>
          <span>Operations cockpit</span>
        </div>
        <div className="provenance">
          <span>Version 0.1.0-preview</span>
          <span>Updated 2026-09-04 13:24:00 America/Toronto</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDark((value) => !value)}
          aria-label={dark ? 'Use light theme' : 'Use dark theme'}
        >
          {dark ? <Sun size={19} /> : <Moon size={19} />}
        </Button>
        <Button variant="ghost" onClick={() => setPaletteOpen(true)}>
          <Command size={18} />
          <kbd>Ctrl Shift F</kbd>
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
        {navigation.map(({ id, label, icon: Icon }) => (
          <button
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'active' : ''}
            onClick={() => {
              setTab(id);
              setQuery('');
            }}
            key={id}
          >
            <Icon aria-hidden="true" size={20} />
            <span>{label}</span>
          </button>
        ))}
        <div className="rail-spacer" role="presentation" />
      </div>
      <section className="workspace">
        <div className="workspace-heading">
          <div>
            <span className="kicker">WORDING LENS</span>
            <h1>{title}</h1>
          </div>
          <StatusPill tone="active">Preview build</StatusPill>
        </div>
        <SearchWorkbench query={query} onQuery={setQuery} />
        <div className="panel-content">
          {tab === 'home' && <HomePanel setTab={setTab} />}
          {tab === 'operations' && <OperationsPanel />}
          {tab === 'features' && <FeaturesPanel query={query} />}
          {tab === 'documentation' && <DocumentationPanel query={query} />}
          {tab === 'status' && <StatusPanel />}
          {tab === 'downloads' && <DownloadsPanel />}
          {tab === 'settings' && <SettingsPanel />}
        </div>
      </section>
      <footer className="bottom-status">
        <span>
          <span className="status-dot" /> Local workspace ready
        </span>
        <span>
          This documentation surface is not the installed application.
        </span>
      </footer>
      {paletteOpen && (
        <div
          className="palette-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setPaletteOpen(false);
          }}
        >
          <dialog
            open
            className="command-palette"
            aria-modal="true"
            aria-label="Command palette"
          >
            <div className="palette-search">
              <Search size={18} />
              <Input
                autoFocus
                placeholder="Find a command, page, setting, or control"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPaletteOpen(false)}
                aria-label="Close command palette"
              >
                <X size={18} />
              </Button>
            </div>
            {navigation.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => {
                  setTab(id);
                  setPaletteOpen(false);
                }}
              >
                <Icon size={18} />
                <span>Open {label}</span>
                <kbd>Enter</kbd>
              </button>
            ))}
          </dialog>
        </div>
      )}
    </main>
  );
}
