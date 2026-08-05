import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, getCurrentProfile } from '@/lib/supabase/server'
import { PostJobWizard } from '@/components/job/post-job-wizard'
import type { Category } from '@/types/database'

export const metadata: Metadata = { title: 'Post a job' }
export const dynamic = 'force-dynamic'

export default async function PostJobPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('categories')
    .select('id, slug, name, min_budget_minor')
    .eq('is_active', true)
    .is('parent_id', null)
    .order('position')

  return (
    <PostJobWizard
      categories={
        (categories ?? []) as Pick<Category, 'id' | 'slug' | 'name' | 'min_budget_minor'>[]
      }
    />
  )
}
