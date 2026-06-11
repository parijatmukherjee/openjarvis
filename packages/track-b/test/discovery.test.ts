import { describe, it, expect, beforeEach } from "vitest";
import {
  addDiscoveredPeer,
  listDiscoveredPeers,
  findPeerByPkHash,
  clearDiscoveredPeers,
} from "../src/network/discovery.js";

describe("Device Discovery", () => {
  beforeEach(() => {
    clearDiscoveredPeers();
  });

  it("discovers a peer", () => {
    addDiscoveredPeer({
      deviceId: "d1",
      deviceName: "MacBook",
      deviceType: "laptop",
      pkHash: "abc123",
      host: "192.168.1.2",
      port: 45678,
    });
    expect(listDiscoveredPeers()).toHaveLength(1);
  });

  it("updates existing peer", () => {
    addDiscoveredPeer({
      deviceId: "d1",
      deviceName: "MacBook",
      deviceType: "laptop",
      pkHash: "abc123",
      host: "192.168.1.2",
      port: 45678,
    });
    addDiscoveredPeer({
      deviceId: "d1",
      deviceName: "MacBook Pro",
      deviceType: "laptop",
      pkHash: "abc123",
      host: "192.168.1.2",
      port: 45678,
    });
    expect(listDiscoveredPeers()).toHaveLength(1);
    expect(listDiscoveredPeers()[0].deviceName).toBe("MacBook Pro");
  });

  it("finds peer by pk hash", () => {
    addDiscoveredPeer({
      deviceId: "d1",
      deviceName: "MacBook",
      deviceType: "laptop",
      pkHash: "abc123",
      host: "192.168.1.2",
      port: 45678,
    });
    const peer = findPeerByPkHash("abc123");
    expect(peer?.deviceName).toBe("MacBook");
  });
});
