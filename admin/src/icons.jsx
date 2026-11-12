// One icon set for the whole admin panel (lucide). Use these instead of emojis.
import React from 'react';
import { Star } from 'lucide-react';

export {
  Award, BarChart3, Building2, Download, ClipboardList, Trophy, TriangleAlert, Medal, Star,
  Pencil, Check, X, ExternalLink, Settings as SettingsIcon, UserCheck, Facebook, Instagram, Twitter, MessageCircle,
  Phone, Bell, Smartphone, Link as LinkIcon, Clock, Image as ImageIcon, Users,
} from 'lucide-react';

/** Filled and empty stars for a 1 to 5 rating. */
export function Stars({ n, size = 13 }) {
  return (
    <span className="stars" aria-label={`${n} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} strokeWidth={2} fill={i <= n ? 'currentColor' : 'none'} style={{ opacity: i <= n ? 1 : 0.35 }} />
      ))}
    </span>
  );
}

/** Inline icon + text, vertically centred. */
export function IconText({ icon: Icon, children, size = 15, gap = 6, color }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap, color }}>
      <Icon size={size} strokeWidth={2} aria-hidden="true" />{children}
    </span>
  );
}

/** Points badge content: star icon + number. */
export function Pts({ children, size = 12 }) {
  return <><Star size={size} strokeWidth={2.2} fill="currentColor" aria-hidden="true" />{children}</>;
}
