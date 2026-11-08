import { memo } from 'react'

import Section from '../../components/Section'
import MergeSources from './MergeSources'
import SourceList from '../Basic/Source'
import SourceName from '../Basic/SourceName'
import { useI18n } from '@/lang'

export default memo(() => {
  const t = useI18n()

  return (
    <Section title={t('setting_source')}>
      <MergeSources />
      <SourceList />
      <SourceName />
    </Section>
  )
})
