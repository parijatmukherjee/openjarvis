export interface DiscoveredPeer {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  pkHash: string;
  host: string;
  port: number;
}

const discoveredPeers: DiscoveredPeer[] = [];

export function addDiscoveredPeer(peer: DiscoveredPeer): void {
  const idx = discoveredPeers.findIndex((p) => p.deviceId === peer.deviceId);
  if (idx >= 0) {
    discoveredPeers[idx] = peer;
  } else {
    discoveredPeers.push(peer);
  }
}

export function listDiscoveredPeers(): DiscoveredPeer[] {
  return [...discoveredPeers];
}

export function clearDiscoveredPeers(): void {
  discoveredPeers.length = 0;
}

export function findPeerByPkHash(pkHash: string): DiscoveredPeer | undefined {
  return discoveredPeers.find((p) => p.pkHash === pkHash);
}
