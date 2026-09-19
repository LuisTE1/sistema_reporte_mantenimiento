import React from 'react'

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const Svg = ({ size = 18, children, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} style={{ flexShrink: 0, ...style }}>
    {children}
  </svg>
)

export const ChartIcon = (p) => (
  <Svg {...p}><path d="M4 20V10M12 20V4M20 20v-7" /></Svg>
)

export const BookIcon = (p) => (
  <Svg {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></Svg>
)

export const PackageIcon = (p) => (
  <Svg {...p}><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="M3.3 6.96 12 12.01l8.7-5.05M12 22.08V12" /></Svg>
)

export const UsersIcon = (p) => (
  <Svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Svg>
)

export const WrenchIcon = (p) => (
  <Svg {...p}><path d="M14.7 6.3a4 4 0 1 0-5.66 5.66l-6.2 6.2a1.5 1.5 0 0 0 2.12 2.12l6.2-6.2a4 4 0 0 0 5.66-5.66l-2.83 2.83-2.12-2.12z" /></Svg>
)

export const GearIcon = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></Svg>
)

export const PulseIcon = (p) => (
  <Svg {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></Svg>
)

export const SmartphoneIcon = (p) => (
  <Svg {...p}><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></Svg>
)

export const DoorIcon = (p) => (
  <Svg {...p}><path d="M13 4v16M13 4l6 1.5v13L13 20M4 4h9v16H4z" /></Svg>
)

export const XIcon = (p) => (
  <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>
)

export const MenuIcon = (p) => (
  <Svg {...p}><path d="M3 6h18M3 12h18M3 18h18" /></Svg>
)

export const CollapseIcon = (p) => (
  <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></Svg>
)

export const GasPumpIcon = (p) => (
  <Svg {...p}><path d="M3 22V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v13" /><path d="M3 13h8M13 7V4a2 2 0 0 1 2-2h1" /><path d="M17 22V11l2.5 2.5a2 2 0 0 1 .5 1.3V19a1.5 1.5 0 0 1-3 0" /></Svg>
)

export const TruckIcon = (p) => (
  <Svg {...p}><path d="M1 3h13v13H1z" /><path d="M14 8h4l3 3v5h-7V8Z" /><circle cx="5.5" cy="18.5" r="1.8" /><circle cx="17.5" cy="18.5" r="1.8" /></Svg>
)

export const RefreshIcon = (p) => (
  <Svg {...p}><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></Svg>
)

export const ClockIcon = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></Svg>
)

export const SlidersIcon = (p) => (
  <Svg {...p}><path d="M4 21V14M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" /><path d="M2 14h4M10 8h4M18 12h4" /></Svg>
)

export const DownloadIcon = (p) => (
  <Svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5M12 15V3" /></Svg>
)

export const TrashIcon = (p) => (
  <Svg {...p}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /><path d="M10 11v6M14 11v6" /></Svg>
)

export const CheckCircleIcon = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m9 12 2 2 4-4" /></Svg>
)

export const BroomIcon = (p) => (
  <Svg {...p}><path d="M19 5 9 15" /><path d="m10 6 4 4-9 9-3-1 1-3z" /><path d="M14.5 10.5 19 15l3-3-4.5-4.5" /></Svg>
)
