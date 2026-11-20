/**
 * Transparent hourly pricing engine.
 * Benchmark medians come from the rate_benchmarks table, each row carrying its
 * source and as-of date. The engine never invents a benchmark: if a category has
 * no benchmark, it returns an explanatory error instead of a fabricated rate.
 */

const METRO_CITIES = [
  'mumbai',
  'delhi',
  'new delhi',
  'gurugram',
  'gurgaon',
  'noida',
  'bengaluru',
  'bangalore',
  'hyderabad',
  'pune',
  'chennai',
  'kolkata'
];

export const CATEGORY_LABELS = {
  technology: 'Information Technology & Software',
  'software-testing': 'Software Testing & QA',
  design: 'UI/UX & Product Design',
  'graphic-design': 'Graphic Design',
  hr: 'Human Resources',
  recruitment: 'Recruitment & Talent Acquisition',
  marketing: 'Digital Marketing',
  finance: 'Finance & Accounting',
  'business-development': 'Business Development',
  administration: 'Administration',
  operations: 'Operations',
  'project-management': 'Project Management',
  'customer-support': 'Customer Support',
  'data-analytics': 'Data Analytics',
  engineering: 'Engineering',
  legal: 'Legal & Compliance',
  other: 'Other Professional Services'
};

export function levelForExperience(years) {
  if (years >= 10) return 'lead';
  if (years >= 6) return 'senior';
  return 'mid';
}

export function experienceFactor(years) {
  const y = Math.max(3, Number(years) || 3);
  if (y <= 5) return 1 + (y - 3) * 0.05;
  if (y <= 10) return 1.1 + (y - 5) * 0.035;
  return Math.min(1.75, 1.275 + (y - 10) * 0.02);
}

export function assessmentFactor(score) {
  if (score === null || score === undefined) return 0.9;
  const normalized = Math.max(0, Math.min(100, Number(score)));
  return 1 + ((normalized - 70) / 30) * 0.25;
}

export function certificationFactor(certifications = []) {
  return 1 + Math.min(3, certifications.length) * 0.04;
}

export function educationFactor(education = '') {
  const value = String(education).toLowerCase();
  if (/phd|doctorate/.test(value)) return 1.1;
  if (/master|mba|m\.tech|mca|post.?graduate/.test(value)) return 1.06;
  if (/bachelor|b\.tech|bca|graduate|chartered|ca\b|cs\b/.test(value)) return 1.03;
  return 1;
}

export function locationFactor(city = '') {
  const value = String(city).trim().toLowerCase();
  if (!value) return 1;
  if (METRO_CITIES.includes(value)) return 1.15;
  return 1;
}

export function industryFactor(industry = '') {
  const value = String(industry).toLowerCase();
  if (/technology|software|product|saas/.test(value)) return 1.12;
  if (/bank|financial|fintech|insurance/.test(value)) return 1.08;
  if (/consult|professional services/.test(value)) return 1.06;
  if (/e-?commerce|retail/.test(value)) return 1.04;
  return 1;
}

export function performanceFactor(rating) {
  if (!rating) return 1;
  return 0.92 + (Math.max(0, Math.min(5, Number(rating))) / 5) * 0.12;
}

export function roundToNearest(value, step = 1000) {
  return Math.round(value / step) * step;
}

export function recommendRate({
  benchmark,
  yearsExperience,
  assessmentScore,
  certifications = [],
  education,
  city,
  industry,
  rating,
  demandIndex = 1
}) {
  if (!benchmark) {
    return {
      available: false,
      reason:
        'No verified market benchmark exists for this category and level yet. A pricing analyst must add a sourced benchmark before a rate can be recommended.'
    };
  }
  const base = benchmark.median_hourly_paise;
  const steps = [];
  const add = (label, factor, detail) => {
    steps.push({
      label,
      factor: Number(factor.toFixed(4)),
      detail,
      impactPaise: Math.round(base * (factor - 1))
    });
    return factor;
  };

  const factors = [
    add(
      'Experience',
      experienceFactor(yearsExperience),
      `${Number(yearsExperience).toFixed(1)} years verified experience (3-year platform minimum)`
    ),
    add(
      'Assessment',
      assessmentFactor(assessmentScore),
      assessmentScore == null
        ? 'No passed Flamingo assessment yet — provisional rate applies'
        : `Verified assessment score ${Math.round(assessmentScore)}/100`
    ),
    add(
      'Certifications',
      certificationFactor(certifications),
      `${certifications.length} verified certification(s)`
    ),
    add('Education', educationFactor(education), education || 'Not specified'),
    add('Location', locationFactor(city), city || 'Location not specified'),
    add('Industry', industryFactor(industry), industry || 'Industry not specified'),
    add(
      'Verified performance',
      performanceFactor(rating),
      rating ? `${Number(rating).toFixed(1)}/5 average employer rating` : 'No completed assignments yet'
    ),
    add('Market demand', demandIndex, `Category demand index ${Number(demandIndex).toFixed(2)}`)
  ];

  const multiplier = factors.reduce((product, factor) => product * factor, 1);
  const unclamped = Math.round(base * multiplier);
  const floor = benchmark.min_hourly_paise;
  const ceiling = benchmark.max_hourly_paise;
  const clamped = Math.max(floor, Math.min(ceiling, unclamped));
  const recommended = roundToNearest(clamped, 1000);

  return {
    available: true,
    recommendedHourlyPaise: recommended,
    benchmark: {
      minHourlyPaise: floor,
      medianHourlyPaise: base,
      maxHourlyPaise: ceiling,
      level: benchmark.level,
      sourceName: benchmark.source_name,
      sourceUrl: benchmark.source_url,
      asOf: benchmark.as_of,
      demandIndex
    },
    multiplier: Number(multiplier.toFixed(4)),
    unclampedHourlyPaise: unclamped,
    clamped: clamped !== unclamped,
    steps,
    methodology:
      'Start from the sourced category median, apply documented multipliers, then clamp inside the sourced market range. Rates are recommendations only; professionals may publish a rate inside the range and employers may negotiate approved exceptions.'
  };
}
