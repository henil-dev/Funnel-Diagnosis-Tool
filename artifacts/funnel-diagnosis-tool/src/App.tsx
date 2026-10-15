import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Activity, AlertTriangle, ArrowDownRight, ArrowRight, BarChart3, Check, CircleHelp, RotateCcw, Sparkles, Target, Trash2, Plus } from 'lucide-react';

type FunnelStage = { id: string; name: string; visitors: string };
type Scenario = { stages: FunnelStage[]; target: string };

const STORAGE_KEY = 'funnel-diagnosis-scenario-v1';
const sampleScenario: Scenario = {
  stages: [
    { id: 'sample-1', name: 'Landing page visits', visitors: '12840' },
    { id: 'sample-2', name: 'Product explored', visitors: '4210' },
    { id: 'sample-3', name: 'Trial started', visitors: '2670' },
    { id: 'sample-4', name: 'Paid customer', visitors: '814' },
  ],
  target: '8',
};

function getInitialScenario(): Scenario {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Scenario;
      if (Array.isArray(parsed.stages) && typeof parsed.target === 'string') {
        return {
          stages: parsed.stages.map((stage, index) => ({
            id: String(stage.id || `stage-${index + 1}`),
            name: String(stage.name ?? ''),
            visitors: String(stage.visitors ?? ''),
          })),
          target: parsed.target,
        };
      }
    }
  } catch {
    // A malformed or unavailable local save falls back to the sample scenario.
  }
  return sampleScenario;
}

function App() {
  const [scenario, setScenario] = useState<Scenario>(getInitialScenario);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scenario));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [scenario]);

  const stageNumbers = scenario.stages.map((stage) => Number(stage.visitors));
  const stageValidity = scenario.stages.map((stage) => {
    const trimmed = stage.visitors.trim();
    return trimmed !== '' && /^\d+$/.test(trimmed) && Number.isSafeInteger(Number(trimmed));
  });
  const validTarget = scenario.target.trim() !== '' && /^\d+(\.\d+)?$/.test(scenario.target) &&
    Number(scenario.target) >= 0 && Number(scenario.target) <= 100;
  const namesValid = scenario.stages.every((stage) => stage.name.trim().length > 0);
  const validCounts = stageValidity.every(Boolean);
  const counts = stageNumbers;
  const hasValidScenario = scenario.stages.length >= 2 && validCounts && validTarget && namesValid;

  const analysis = useMemo(() => {
    if (!hasValidScenario) return null;
    const transitions = scenario.stages.slice(1).map((stage, index) => {
      const from = counts[index];
      const to = counts[index + 1];
      return {
        fromName: scenario.stages[index].name,
        toName: stage.name,
        from,
        to,
        conversion: from > 0 ? (to / from) * 100 : 0,
        dropoff: from > 0 ? ((from - to) / from) * 100 : 0,
        lost: from - to,
      };
    });
    const overall = counts[0] > 0 ? (counts[counts.length - 1] / counts[0]) * 100 : 0;
    const biggestLeak = transitions.length ? transitions.reduce((max, item) => item.dropoff > max.dropoff ? item : max) : null;
    return { transitions, overall, target: Number(scenario.target), gap: Number(scenario.target) - overall, biggestLeak };
  }, [scenario, hasValidScenario, counts.join('|')]);

  const issues: { kind: 'warning' | 'info'; text: string }[] = [];
  if (scenario.stages.length < 2) issues.push({ kind: 'warning', text: 'Add at least two stages to calculate a journey conversion.' });
  if (!namesValid) issues.push({ kind: 'warning', text: 'Every stage needs a name so the journey is clear.' });
  if (!validTarget) issues.push({ kind: 'warning', text: 'Target must be a number from 0 to 100.' });
  if (stageValidity.some((valid) => !valid)) issues.push({ kind: 'warning', text: 'Visitor counts must be nonnegative whole numbers. Enter a count for each stage.' });
  if (stageValidity.every(Boolean) && counts.some((value, index) => index > 0 && value > counts[index - 1])) {
    issues.push({ kind: 'warning', text: 'A later stage has more visitors than the stage before it. Check that stage definitions and counting windows match.' });
  }
  if (stageValidity.every(Boolean) && counts.some((value) => value === 0)) {
    issues.push({ kind: 'info', text: 'A stage has zero visitors. Rates from or into this stage may not be meaningful.' });
  }
  if (!saved) issues.push({ kind: 'warning', text: 'This browser could not save locally. Your changes may not persist after closing this tab.' });

  const recommendations = useMemo(() => {
    if (!analysis) return [];
    const generated: { kind: string; title: string; body: string; next: string; color: string }[] = [];
    if (analysis.biggestLeak) {
      const leak = analysis.biggestLeak;
      generated.push({
        kind: 'Largest leak',
        title: `Inspect the ${leak.fromName} → ${leak.toName} handoff`,
        body: `${formatNumber(leak.lost)} visitors do not appear in the next stage (${formatPercent(leak.dropoff)} drop-off). Compare the experience and event definitions at this transition.`,
        next: 'Start with this transition',
        color: 'hsl(var(--accent))',
      });
    }
    if (analysis.gap > 0) {
      generated.push({
        kind: 'Target gap',
        title: `Find ${formatPercent(analysis.gap)} of conversion lift`,
        body: `Current overall conversion is ${formatPercent(analysis.overall)} against your ${formatPercent(analysis.target)} target. Model small improvements at the highest-loss stage first.`,
        next: 'Use as a planning hypothesis',
        color: '#b27838',
      });
    } else {
      generated.push({
        kind: 'Target reached',
        title: 'Protect what is already working',
        body: `The observed ${formatPercent(analysis.overall)} overall conversion is at or above the ${formatPercent(analysis.target)} target. Check the same stages over the next reporting period.`,
        next: 'Confirm with another period',
        color: 'hsl(var(--primary))',
      });
    }
    const zeroTransitions = analysis.transitions.filter((item) => item.from === 0);
    if (zeroTransitions.length) {
      generated.push({
        kind: 'Measurement check',
        title: 'Review zero-volume stages',
        body: 'Conversion cannot be interpreted when the previous stage has no visitors. Confirm event tracking and date ranges before drawing conclusions.',
        next: 'Check tracking and time window',
        color: '#667b91',
      });
    } else if (analysis.transitions.length > 1) {
      const best = analysis.transitions.reduce((max, item) => item.conversion > max.conversion ? item : max);
      generated.push({
        kind: 'Relative strength',
        title: `Learn from the ${best.fromName} → ${best.toName} step`,
        body: `This transition retains ${formatPercent(best.conversion)} of visitors, the strongest rate in this funnel. Look for a useful contrast with the leakiest handoff.`,
        next: 'Compare experiences, not just rates',
        color: '#587f79',
      });
    }
    return generated.slice(0, 3);
  }, [analysis]);

  function updateStage(id: string, field: 'name' | 'visitors', value: string) {
    setScenario((current) => ({ ...current, stages: current.stages.map((stage) => stage.id === id ? { ...stage, [field]: value } : stage) }));
  }

  function addStage() {
    setScenario((current) => ({
      ...current,
      stages: [...current.stages, { id: `stage-${Date.now()}-${current.stages.length}`, name: '', visitors: '' }],
    }));
  }

  function removeStage(id: string) {
    setScenario((current) => ({ ...current, stages: current.stages.filter((stage) => stage.id !== id) }));
  }

  function restoreSample() {
    setScenario({ stages: sampleScenario.stages.map((stage) => ({ ...stage })), target: sampleScenario.target });
  }

  function clearScenario() {
    if (window.confirm('Clear the current scenario? This will keep two blank stages so you can start a new funnel.')) {
      setScenario({ stages: [{ id: `new-${Date.now()}-1`, name: '', visitors: '' }, { id: `new-${Date.now()}-2`, name: '', visitors: '' }], target: '5' });
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Activity size={18} strokeWidth={2.3} /></span><span>Funnel Fieldnotes</span></div>
        <div className="top-meta"><span><i className="status-dot" />Local-only scenario</span><span className="mono" data-testid="status-save">{saved ? 'LOCAL · ON' : 'LOCAL · OFF'}</span></div>
      </header>
      <main className="main-wrap">
        <section className="intro">
          <div>
            <div className="eyebrow">Conversion journey / diagnosis</div>
            <h1>Find where<br />momentum slips.</h1>
            <p>Map the visitor counts that matter. See where the journey thins out, then choose a practical next question to investigate.</p>
          </div>
          <div className="intro-tools">
            <button className="btn" onClick={clearScenario} data-testid="button-clear-scenario"><RotateCcw size={14} />Clear scenario</button>
            <button className="btn btn-primary" onClick={restoreSample} data-testid="button-restore-sample"><BarChart3 size={14} />Load sample</button>
          </div>
        </section>

        <section className="workspace">
          <div className="panel" aria-label="Funnel editor">
            <div className="panel-head">
              <div><div className="panel-title"><span className="step-index">01</span> Your funnel</div><div className="panel-subtitle">Enter unique people for the same reporting period.</div></div>
              <span className="mono" style={{ color: 'hsl(var(--muted-foreground))', fontSize: 10 }} data-testid="text-stage-count">{scenario.stages.length} STAGES</span>
            </div>
            <div className="stage-head"><span>#</span><span>Stage name</span><span>Visitors</span><span /></div>
            <div>
              {scenario.stages.map((stage, index) => (
                <div className="stage-row" key={stage.id} data-testid={`row-stage-${stage.id}`}>
                  <span className="stage-num">{String(index + 1).padStart(2, '0')}</span>
                  <input className="field" aria-label={`Stage ${index + 1} name`} placeholder={index === 0 ? 'e.g. Landing page visits' : 'e.g. Trial started'} value={stage.name} onChange={(event) => updateStage(stage.id, 'name', event.target.value)} data-testid={`input-stage-name-${stage.id}`} />
                  <div className="count-wrap"><input className="field mono" aria-label={`Stage ${index + 1} visitors`} placeholder="0" inputMode="numeric" value={stage.visitors} onChange={(event) => updateStage(stage.id, 'visitors', event.target.value)} data-testid={`input-stage-visitors-${stage.id}`} /><span className="count-suffix">PEOPLE</span></div>
                  <button className="icon-btn" title="Remove stage" aria-label={`Remove ${stage.name || `stage ${index + 1}`}`} disabled={scenario.stages.length <= 2} onClick={() => removeStage(stage.id)} data-testid={`button-remove-stage-${stage.id}`}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <button className="btn btn-quiet add-stage" onClick={addStage} data-testid="button-add-stage"><Plus size={14} />Add funnel stage</button>
            <div className="target-box">
              <div><label htmlFor="target-input">Target overall conversion</label><div className="target-help">Your benchmark for first visitor → final stage.</div></div>
              <div className="target-control"><input id="target-input" className="field mono" aria-label="Target overall conversion percentage" value={scenario.target} onChange={(event) => setScenario((current) => ({ ...current, target: event.target.value }))} inputMode="decimal" data-testid="input-target-conversion" /><span>%</span></div>
            </div>
            {issues.length > 0 && <div className="alerts" aria-live="polite" data-testid="list-validation-messages">{issues.map((issue, index) => <div className={`alert ${issue.kind === 'info' ? 'info' : ''}`} key={`${issue.text}-${index}`} data-testid={`message-validation-${index}`}><AlertTriangle size={13} />{issue.text}</div>)}</div>}
            <p className="form-note">Counts should be unique visitors from a consistent date range. Values are never adjusted automatically.</p>
          </div>

          <div className="right-stack">
            <section className="panel summary-panel" aria-label="Overall conversion summary">
              <div className="summary-content">
                <div className="summary-top"><span>02 / Overall readout</span><Target size={16} /></div>
                {analysis ? <>
                  <div className="summary-stat"><span className="summary-value" data-testid="value-overall-conversion">{formatPercent(analysis.overall)}</span><span className="summary-target">target <strong data-testid="value-target-conversion">{formatPercent(analysis.target)}</strong></span></div>
                  <div className="progress-track" aria-label="Overall conversion against target"><div className="progress-fill" style={{ width: `${Math.min(100, analysis.overall / Math.max(analysis.target, 0.01) * 100)}%` }} /></div>
                  <div className="summary-foot"><span>Visitors who reach the final stage</span><strong>{analysis.gap > 0 ? `${formatPercent(analysis.gap)} below target` : 'Target met'}</strong></div>
                  <div className="metric-strip">
                    <div><div className="metric-label">First stage</div><div className="metric-value" data-testid="value-first-stage">{formatNumber(counts[0])} visitors</div></div>
                    <div><div className="metric-label">Final stage</div><div className="metric-value" data-testid="value-final-stage">{formatNumber(counts[counts.length - 1])} visitors</div></div>
                  </div>
                </> : <div className="empty-chart" data-testid="empty-overall-analysis">Complete valid stage names, visitor counts, and a target to see the calculated conversion.</div>}
              </div>
            </section>

            {analysis?.biggestLeak && <section className="panel leak-panel" data-testid="card-largest-leak">
              <div><div className="leak-label"><ArrowDownRight size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Largest observed drop-off</div><div className="leak-stage">{analysis.biggestLeak.fromName} <ArrowRight size={12} style={{ display: 'inline', verticalAlign: 'middle', color: 'hsl(var(--muted-foreground))' }} /> {analysis.biggestLeak.toName}</div><div className="leak-caption">{formatNumber(analysis.biggestLeak.lost)} fewer visitors reach the next stage</div></div>
              <div className="leak-number" data-testid="value-largest-dropoff">{formatPercent(analysis.biggestLeak.dropoff)}</div>
            </section>}

            <section className="panel flow-panel">
              <div className="flow-head"><div className="section-head"><h2>Stage-to-stage</h2><span>{analysis ? 'Conversion / drop-off' : 'Waiting for valid inputs'}</span></div></div>
              {analysis ? <div className="flow-list" data-testid="list-stage-conversions">{analysis.transitions.map((transition, index) => <div className="flow-item" key={`${transition.fromName}-${index}`} data-testid={`row-conversion-${index}`}>
                <div><div className="flow-name">{transition.fromName} <ArrowRight size={10} style={{ display: 'inline', verticalAlign: 'middle', color: 'hsl(var(--muted-foreground))' }} /> {transition.toName}</div><div className="flow-count">{formatNumber(transition.from)} → {formatNumber(transition.to)} visitors</div><div className="flow-meter"><span style={{ width: `${Math.min(100, transition.conversion)}%` }} /></div></div>
                <div className="flow-rates"><div className="flow-percent">{formatPercent(transition.conversion)} convert</div><div className="flow-drop">{formatPercent(transition.dropoff)} drop off</div></div>
              </div>)}</div> : <div className="empty-chart" data-testid="empty-stage-conversions">Stage rates will appear here once the scenario is ready.</div>}
            </section>
          </div>
        </section>

        <section className="recommendations">
          <div className="reco-title-row"><div><div className="eyebrow">03 / What to investigate</div><h2>Useful next questions</h2><p>Transparent rules, not a verdict. Treat these as hypotheses to test.</p></div><span className="mono" style={{ fontSize: 9, color: 'hsl(var(--muted-foreground))' }}><Sparkles size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />RULE-BASED</span></div>
          <div className="reco-list" data-testid="list-recommendations">
            {recommendations.length ? recommendations.map((item, index) => <article className="reco-card" key={item.kind} style={{ '--reco-color': item.color } as CSSProperties} data-testid={`card-recommendation-${index}`}>
              <div className="reco-top"><span className="reco-tag">{item.kind}</span><span className="reco-number">0{index + 1}</span></div><h3>{item.title}</h3><p>{item.body}</p><div className="reco-foot"><Check size={12} />{item.next}</div>
            </article>) : <div className="reco-empty" data-testid="empty-recommendations">Valid stage counts unlock the diagnostic hypotheses below.</div>}
          </div>
        </section>
        <div className="footer-note"><CircleHelp size={14} /><span><strong>How to read this:</strong> conversion rates are calculated directly from the counts entered; drop-off is 100% minus the stage conversion rate. Heuristics highlight patterns to investigate, not causal explanations or statistical/AI analysis. A later stage with more visitors is flagged rather than silently corrected.</span></div>
      </main>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatPercent(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`;
}

export default App;
