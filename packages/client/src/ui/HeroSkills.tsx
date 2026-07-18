import type { HeroState } from '@heroes/engine';
import { t, resolveSkillName } from '../app/i18n';
import { useCollapsed, SectionToggle } from './CollapsibleSection';
import './HeroSkills.css';

/**
 * Section Compétences du tiroir héros (doc 08 §2.3) : nom localisé + rang
 * Novice/Expert/Maître. Lecture seule — `hero.skills` peut être vide tant
 * que le lot K/L n'a pas livré, affiché proprement sans crash. Repliable (E7).
 */
export function HeroSkills({ hero }: { hero: HeroState }) {
  const entries = Object.entries(hero.skills);
  const [collapsed, toggle] = useCollapsed('skills');
  return (
    <section class="hero-skills" data-testid="hero-skills">
      <SectionToggle
        title={t('hero.skillsTitle')}
        collapsed={collapsed}
        onToggle={toggle}
        testId="hero-skills-toggle"
      />
      {!collapsed &&
        (entries.length === 0 ? (
          <p class="hero-skills-empty">{t('hero.noSkills')}</p>
        ) : (
          <ul class="hero-skill-list">
            {entries.map(([skillId, rank]) => (
              <li key={skillId} class="hero-skill">
                <span class="hero-skill-name">{resolveSkillName(skillId)}</span>
                <span class="hero-skill-rank">{t(`skill.rank.${rank}`)}</span>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
