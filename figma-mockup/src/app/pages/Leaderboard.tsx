import { GlassCard } from '../components/GlassCard';
import { Trophy, Medal, Crown, Star, Users, Gift, Link as LinkIcon, Copy } from '@phosphor-icons/react';
import { useState } from 'react';

const leaderboardData = [
  { rank: 1, address: '0x742d...4e5f', points: 12450, staked: 125000, referrals: 23 },
  { rank: 2, address: '0x8a3c...2d1b', points: 11230, staked: 98000, referrals: 19 },
  { rank: 3, address: '0x9f4e...7c8a', points: 10890, staked: 87500, referrals: 17 },
  { rank: 4, address: '0x1b5d...3f2e', points: 9650, staked: 76000, referrals: 15 },
  { rank: 5, address: '0x6c8a...9d4b', points: 8920, staked: 68500, referrals: 14 },
  { rank: 6, address: '0x3e7f...1a5c', points: 8340, staked: 62000, referrals: 12 },
  { rank: 7, address: '0x4d2c...8b9f', points: 7850, staked: 58000, referrals: 11 },
  { rank: 8, address: '0x7a9e...4c3d', points: 7420, staked: 54000, referrals: 10 },
  { rank: 9, address: '0x2f8b...6e7a', points: 6980, staked: 49500, referrals: 9 },
  { rank: 10, address: '0x5c3a...2d8f', points: 6540, staked: 45000, referrals: 8 },
];

export function Leaderboard() {
  const [copiedReferral, setCopiedReferral] = useState(false);
  const referralCode = 'EURC-A7F3K2';
  const userRank = 15;
  const userPoints = 5420;

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(`https://eurcvault.io/ref/${referralCode}`);
    setCopiedReferral(true);
    setTimeout(() => setCopiedReferral(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-light mb-2">Classement & Récompenses</h1>
        <p className="text-muted-foreground">
          Gagnez des points, grimpez au classement et débloquez des récompenses exclusives
        </p>
      </div>

      {/* User Stats */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Trophy className="w-8 h-8 text-white" weight="duotone" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Votre Classement</div>
              <div className="text-3xl font-light">#{userRank}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground mb-1">Points Totaux</div>
            <div className="text-3xl font-light text-accent">{userPoints.toLocaleString()}</div>
          </div>
        </div>
      </GlassCard>

      {/* How to Earn Points */}
      <GlassCard className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <Star className="w-6 h-6 text-accent" weight="duotone" />
          <h2 className="text-2xl font-light">Comment Gagner des Points</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-medium">Staking</h3>
            <p className="text-sm text-muted-foreground">
              Gagnez <span className="text-accent font-medium">1 point par 100 EURC</span> stakés par jour. Plus vous stakez longtemps, plus vous accumulez de points.
            </p>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Exemple</div>
              <div className="text-sm">10,000 EURC = 100 pts/jour</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-accent" />
            </div>
            <h3 className="font-medium">Parrainage</h3>
            <p className="text-sm text-muted-foreground">
              Invitez vos amis et gagnez <span className="text-accent font-medium">500 points</span> par parrain actif, plus <span className="text-accent font-medium">10% de leurs points</span> à vie.
            </p>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Bonus</div>
              <div className="text-sm">Parrain actif = +500 pts</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-chart-3/20 flex items-center justify-center">
              <Gift className="w-6 h-6 text-[var(--chart-3)]" />
            </div>
            <h3 className="font-medium">Multiplicateurs</h3>
            <p className="text-sm text-muted-foreground">
              Débloquez des <span className="text-accent font-medium">multiplicateurs de points</span> en atteignant certains paliers de staking et de parrainage.
            </p>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Palier Elite</div>
              <div className="text-sm">50,000 EURC = x1.5 pts</div>
            </div>
          </div>
        </div>

        {/* Point Tiers */}
        <div className="mt-8 pt-8 border-t border-border">
          <h3 className="font-medium mb-4">Paliers de Multiplicateurs</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-muted/30 rounded-xl text-center">
              <div className="text-sm text-muted-foreground mb-1">Bronze</div>
              <div className="text-lg font-medium mb-2">x1.0</div>
              <div className="text-xs text-muted-foreground">0 - 10K EURC</div>
            </div>
            <div className="p-4 bg-gradient-to-br from-chart-3/20 to-chart-3/10 border border-chart-3/30 rounded-xl text-center">
              <div className="text-sm text-muted-foreground mb-1">Argent</div>
              <div className="text-lg font-medium mb-2">x1.2</div>
              <div className="text-xs text-muted-foreground">10K - 25K EURC</div>
            </div>
            <div className="p-4 bg-gradient-to-br from-accent/20 to-accent/10 border border-accent/30 rounded-xl text-center">
              <div className="text-sm text-muted-foreground mb-1">Or</div>
              <div className="text-lg font-medium mb-2">x1.5</div>
              <div className="text-xs text-muted-foreground">25K - 50K EURC</div>
            </div>
            <div className="p-4 bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 rounded-xl text-center">
              <div className="text-sm text-muted-foreground mb-1">Diamant</div>
              <div className="text-lg font-medium mb-2">x2.0</div>
              <div className="text-xs text-muted-foreground">50K+ EURC</div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Referral Section */}
      <GlassCard className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <LinkIcon className="w-6 h-6 text-primary" weight="duotone" />
          <h2 className="text-2xl font-light">Programme de Parrainage</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-2">Votre Code de Parrainage</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-4 bg-muted/50 rounded-xl font-mono text-lg">
                  {referralCode}
                </div>
                <button
                  onClick={handleCopyReferral}
                  className="px-4 h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-colors flex items-center gap-2"
                >
                  <Copy className="w-5 h-5" />
                  {copiedReferral ? 'Copié!' : 'Copier'}
                </button>
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-2">Lien de Parrainage</div>
              <div className="p-3 bg-muted/50 rounded-xl text-sm font-mono break-all">
                https://eurcvault.io/ref/{referralCode}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-6 bg-gradient-to-br from-accent/10 to-primary/10 border border-accent/20 rounded-xl">
              <h3 className="font-medium mb-2">Vos Statistiques de Parrainage</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Parrains Actifs</span>
                  <span className="text-lg font-medium">7</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Points Gagnés</span>
                  <span className="text-lg font-medium text-accent">4,250 pts</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Commission Mensuelle</span>
                  <span className="text-lg font-medium">+234 EURC</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
          <div className="flex items-start gap-3">
            <Gift className="w-5 h-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-1">Bonus de Parrainage</p>
              <p className="text-muted-foreground">
                Chaque personne que vous parrainez vous rapporte 500 points immédiatement + 10% de tous les points qu'elle gagnera. De plus, vous recevez 5% de commission sur leurs récompenses de staking.
              </p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Leaderboard Table */}
      <GlassCard className="overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-light">Top 10 Classement</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Rang</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Adresse</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Points</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">EURC Stakés</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Parrainages</th>
              </tr>
            </thead>
            <tbody>
              {leaderboardData.map((user) => (
                <tr key={user.rank} className="border-b border-border hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {user.rank === 1 && (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center">
                          <Crown className="w-6 h-6 text-white" weight="fill" />
                        </div>
                      )}
                      {user.rank === 2 && (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center">
                          <Medal className="w-6 h-6 text-white" weight="fill" />
                        </div>
                      )}
                      {user.rank === 3 && (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center">
                          <Medal className="w-6 h-6 text-white" weight="fill" />
                        </div>
                      )}
                      {user.rank > 3 && (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <span className="font-medium">#{user.rank}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm">{user.address}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-accent">{user.points.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium">{user.staked.toLocaleString()} EURC</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span>{user.referrals}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Rewards Section */}
      <GlassCard className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <Gift className="w-6 h-6 text-accent" weight="duotone" />
          <h2 className="text-2xl font-light">Récompenses Mensuelles</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-2 border-yellow-500/30 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <Crown className="w-8 h-8 text-yellow-500" weight="duotone" />
              <div>
                <div className="text-2xl font-medium">1ère Place</div>
                <div className="text-sm text-muted-foreground">Top Staker</div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Bonus EURC</span>
                <span className="font-medium">5,000 €</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">APY Bonus</span>
                <span className="font-medium">+2%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">NFT Exclusif</span>
                <span className="font-medium">Oui</span>
              </div>
            </div>
          </div>

          <div className="p-6 bg-gradient-to-br from-gray-400/20 to-gray-500/10 border-2 border-gray-400/30 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <Medal className="w-8 h-8 text-gray-400" weight="duotone" />
              <div>
                <div className="text-2xl font-medium">2ème Place</div>
                <div className="text-sm text-muted-foreground">Runner-up</div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Bonus EURC</span>
                <span className="font-medium">3,000 €</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">APY Bonus</span>
                <span className="font-medium">+1.5%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">NFT Exclusif</span>
                <span className="font-medium">Oui</span>
              </div>
            </div>
          </div>

          <div className="p-6 bg-gradient-to-br from-orange-600/20 to-orange-700/10 border-2 border-orange-600/30 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <Medal className="w-8 h-8 text-orange-600" weight="duotone" />
              <div>
                <div className="text-2xl font-medium">3ème Place</div>
                <div className="text-sm text-muted-foreground">Podium</div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Bonus EURC</span>
                <span className="font-medium">1,500 €</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">APY Bonus</span>
                <span className="font-medium">+1%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">NFT Exclusif</span>
                <span className="font-medium">Oui</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-muted/30 rounded-xl text-sm text-muted-foreground">
          <p>
            Les récompenses sont distribuées le 1er de chaque mois aux 10 meilleurs classés. 
            Les places 4-10 reçoivent également des bonus EURC dégressifs de 1,000€ à 200€.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
