'use client';

import { useState } from 'react';
import { useVaults } from '@/hooks/useVault';
import { VaultCard } from '@/components/vault/VaultCard';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Search } from 'lucide-react';

export default function VaultsPage() {
  const { vaults, loading } = useVaults();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredVaults = vaults.filter((vault) =>
    vault.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vault.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light text-foreground mb-2">Staking Vaults</h1>
          <p className="text-foreground-secondary font-light">
            Choose a vault that matches your risk tolerance and return expectations
          </p>
        </div>
      </div>

      <div className="max-w-md">
        <Input
          type="text"
          placeholder="Search vaults..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          rightElement={<Search className="w-5 h-5 text-foreground-secondary" />}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height="350px" />
          ))}
        </div>
      ) : filteredVaults.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-foreground-secondary font-light">
            No vaults found matching your search.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVaults.map((vault) => (
            <VaultCard key={vault.id} vault={vault} />
          ))}
        </div>
      )}
    </div>
  );
}
