'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { usePageTitle } from '@/hooks/usePageTitle';
import { clsx } from 'clsx';

interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

const FAQS: FaqItem[] = [
  // Getting Started
  {
    category: 'Getting Started',
    question: 'What is the EURC Yield Optimizer?',
    answer: 'It\'s a Ranger Earn vault that automatically maximizes your EURC yield by routing capital across three Solana lending protocols — Drift, Kamino, and Save. The bot monitors rates every 5 minutes and rebalances when it finds better opportunities, so you earn more than parking EURC in any single protocol.',
  },
  {
    category: 'Getting Started',
    question: 'How do I deposit?',
    answer: 'Connect your Solana wallet (Phantom, Solflare, or any compatible wallet), go to the Deposit page, enter an amount of EURC, and confirm the transaction in your wallet. You\'ll receive pbEURC shares in return — these are yield-bearing receipt tokens that grow in value over time.',
  },
  {
    category: 'Getting Started',
    question: 'What is pbEURC?',
    answer: 'pbEURC is a yield-bearing receipt token. When you deposit EURC, you receive pbEURC at the current exchange rate (starts at 1:1). As the vault earns yield, the exchange rate grows — meaning your pbEURC becomes worth more EURC over time. When you withdraw, you burn pbEURC and receive more EURC than you deposited. No manual claiming needed.',
  },
  {
    category: 'Getting Started',
    question: 'What\'s the minimum deposit?',
    answer: 'There\'s no minimum deposit — you can deposit any amount of EURC. However, very small deposits may not be economical due to Solana transaction fees (~$0.001 per transaction).',
  },
  // Yield & Returns
  {
    category: 'Yield & Returns',
    question: 'What APY can I expect?',
    answer: 'The vault targets 12-15% APY during active market conditions when EURC lending rates are elevated (historically 8-15%). During quiet markets like the current period, rates are lower (0.5-3%). The strategy still captures value through rate arbitrage and compounding even in quiet periods. You can see live rates on the Dashboard page.',
  },
  {
    category: 'Yield & Returns',
    question: 'How does the vault generate yield?',
    answer: 'Three ways: (1) Base lending yield — EURC is deposited into lending protocols where borrowers pay interest. (2) Rate arbitrage — the bot routes capital to whichever protocol offers the highest rate, capturing 50-800 bps of spread. (3) Auto-compounding — accrued interest is reinvested hourly into the top protocol.',
  },
  {
    category: 'Yield & Returns',
    question: 'Why are current rates low?',
    answer: 'EURC lending rates are cyclical. During quiet market periods with low borrower demand (like now), rates sit at 0.2-1%. During active markets — token launches, funding rate arbitrage events, protocol incentive campaigns — rates spike to 8-15%+. The strategy is designed for the full cycle, not just the quiet periods.',
  },
  // Fees
  {
    category: 'Fees',
    question: 'What fees does the vault charge?',
    answer: 'Two fees: (1) 0.5% annual management fee on total vault assets — accrues continuously and covers bot infrastructure, RPC nodes, and monitoring. (2) 10% performance fee on profits only, with a high-water mark — never charged when recovering from drawdowns. There are no entry fees, exit fees, or hidden charges.',
  },
  {
    category: 'Fees',
    question: 'How do fees affect my returns?',
    answer: 'At 12% gross APY: management fee deducts ~0.5%, performance fee deducts ~1.15%, leaving you with ~10.35% net APY. At lower gross rates, the impact is proportionally smaller. The performance fee only applies to profits, so you never pay a performance fee if the vault doesn\'t earn.',
  },
  // Safety & Risk
  {
    category: 'Safety & Risk',
    question: 'Is my money safe?',
    answer: 'The vault has multiple safety layers: a circuit breaker that halts all activity if TVL drops more than 2% from peak, concentration limits (max 70% in any single protocol), oracle sanity checks that reject manipulated rates, and a 5% idle reserve for instant withdrawals. However, like all DeFi, there is inherent smart contract risk. Only deposit what you can afford to lose.',
  },
  {
    category: 'Safety & Risk',
    question: 'What happens if one of the protocols gets hacked?',
    answer: 'The vault maintains a minimum 10% allocation in each protocol and never puts more than 70% in any single one. If a protocol is compromised, the maximum exposure is 70% of vault funds. The circuit breaker would trigger immediately (on >2% TVL drop), halting further operations and alerting the team. The remaining funds in other protocols would be safe.',
  },
  {
    category: 'Safety & Risk',
    question: 'What is the circuit breaker?',
    answer: 'The circuit breaker is an emergency safety mechanism. If the vault\'s total value drops more than 2% from its peak, the circuit breaker trips — all rebalancing and compounding halt immediately. Funds stay in their current positions until a human operator reviews the situation and manually resets the system. This prevents cascading losses.',
  },
  {
    category: 'Safety & Risk',
    question: 'Has the vault been audited?',
    answer: 'The vault strategy code has been reviewed internally with 82 unit tests covering rate edge cases, risk scenarios, and allocation math. A formal third-party audit has not been completed yet. The underlying Voltr vault infrastructure has been independently audited by the Ranger team.',
  },
  // Withdrawals
  {
    category: 'Withdrawals',
    question: 'Can I withdraw anytime?',
    answer: 'Yes. Small withdrawals are typically instant, serviced from the vault\'s 5% idle reserve. Larger withdrawals may require a 24-hour cooldown period to allow the bot to unwind protocol positions without market impact. There are no lock-up penalties or exit fees.',
  },
  {
    category: 'Withdrawals',
    question: 'How do I withdraw?',
    answer: 'Go to the Deposit page, switch to the Withdraw tab, enter the EURC amount you want to receive, and confirm the transaction. Your pbEURC shares are burned at the current exchange rate, and you receive EURC directly to your wallet.',
  },
  // Technical
  {
    category: 'Technical',
    question: 'Which protocols does the vault use?',
    answer: 'Three Solana lending protocols: Drift (spot market lending), Kamino (kLend algorithmic optimizer), and Save (formerly Solend). Each has different utilization curves and borrower demand, creating the rate divergence that the strategy exploits.',
  },
  {
    category: 'Technical',
    question: 'How often does the bot rebalance?',
    answer: 'The bot checks rates every 5 minutes and evaluates rebalancing every 15 minutes. It only rebalances when the spread between the best and worst protocol exceeds 50 basis points AND at least 30 minutes have passed since the last rebalance. This prevents unnecessary churn while still capturing meaningful opportunities.',
  },
];

const CATEGORIES = [...new Set(FAQS.map((f) => f.category))];

function FaqAccordion({ item, isOpen, onToggle }: { item: FaqItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full py-4 text-left gap-4"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-medium text-foreground">{item.question}</span>
        <ChevronDown className={clsx(
          'h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200',
          isOpen && 'rotate-180',
        )} />
      </button>
      {isOpen && (
        <p className="pb-4 text-sm text-muted-foreground leading-relaxed">
          {item.answer}
        </p>
      )}
    </div>
  );
}

export default function FaqPage() {
  usePageTitle('FAQ');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Vault
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Frequently Asked Questions</h1>
          <p className="mt-2 text-base text-muted-foreground">
            Everything you need to know about depositing, earning yield, and staying safe.
          </p>
        </div>

        <div className="space-y-8">
          {CATEGORIES.map((category) => {
            const categoryFaqs = FAQS.filter((f) => f.category === category);
            return (
              <div key={category}>
                <h2 className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">
                  {category}
                </h2>
                <div className="rounded-2xl border border-border bg-card px-5">
                  {categoryFaqs.map((item) => {
                    const globalIndex = FAQS.indexOf(item);
                    return (
                      <FaqAccordion
                        key={globalIndex}
                        item={item}
                        isOpen={openIndex === globalIndex}
                        onToggle={() => setOpenIndex(openIndex === globalIndex ? null : globalIndex)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Still have questions? Check the full documentation or try the strategy simulator.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover transition-colors"
            >
              Read the Docs
            </Link>
            <Link
              href="/simulator"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
            >
              Try the Simulator
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
