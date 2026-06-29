import { Package, Cpu, MemoryStick, HardDrive, Network } from "lucide-react";

export const DEVICE_TABS = [
  { label: "Overview", suffix: "", Icon: Package },
  { label: "Hardware Inventory", suffix: "inventory", Icon: Package },
  { label: "CPU", suffix: "mon/cpu", Icon: Cpu },
  { label: "Memory", suffix: "mon/memory", Icon: MemoryStick },
  { label: "Storage", suffix: "mon/disk", Icon: HardDrive },
  { label: "Network I/O", suffix: "mon/network", Icon: Network },
  { label: "Storage I/O", suffix: "mon/disk_io", Icon: HardDrive },
  { label: "Partition", suffix: "mon/partition", Icon: HardDrive },
];