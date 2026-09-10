'use client';

import Link from 'next/link';
import { useLocale } from '@/components/LocaleProvider';

export default function BrandLogo({ href = '/', className = '' }: { href?: string; className?: string }) {
  const { copy } = useLocale();

  return (
    <Link href={href} className={`inline-flex items-center ${className}`} aria-label={copy.brand.name}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt={copy.brand.name} className="h-12 w-auto rounded-xl object-contain md:h-14" />
    </Link>
  );
}
