'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table } from '@/components/ui/Table'
import { Modal } from '@/components/ui/Modal'
import { get, post, ApiError } from '@/lib/api'
import type { Contact } from '@/lib/types'

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [draft, setDraft] = useState<Omit<Contact, 'id'>>({
    fullName: '',
    email: '',
    extension: '',
    phone: '',
    department: '',
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await get<Contact[]>('/contacts')
      setContacts(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load contacts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter((c) =>
      [c.fullName, c.extension, c.phone, c.department, c.email ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [contacts, query])

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.fullName || !draft.extension) {
      setFormError('Name and extension are required.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const created = await post<Contact>('/contacts', draft)
      setContacts((prev) => [...prev, created])
      setAddOpen(false)
      setDraft({ fullName: '', email: '', extension: '', phone: '', department: '' })
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create contact.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Contacts</h1>
          <p className="text-sm text-text-muted">Tenant directory of users and extensions.</p>
        </div>
        <div className="flex items-end gap-2">
          <Input
            type="search"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search contacts"
            wrapperClassName="w-56"
          />
          <Button onClick={() => setAddOpen(true)} aria-label="Add contact">+ Add</Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">{error}</p>
      ) : null}

      <Table<Contact>
        data={filtered}
        rowKey={(c) => c.id}
        emptyMessage={loading ? 'Loading contacts…' : 'No contacts found.'}
        columns={[
          { key: 'fullName', header: 'Name' },
          { key: 'extension', header: 'Extension' },
          { key: 'phone', header: 'Phone', render: (c) => c.phone || '—' },
          { key: 'department', header: 'Department', render: (c) => c.department || '—' },
          { key: 'email', header: 'Email', render: (c) => c.email || '—' },
        ]}
      />

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add contact"
        description="Create a new directory entry."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button form="add-contact-form" type="submit" loading={saving} aria-label="Save contact">Save</Button>
          </>
        }
      >
        <form id="add-contact-form" onSubmit={onCreate} className="flex flex-col gap-3">
          <Input label="Full name" value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} required />
          <Input label="Extension" value={draft.extension} onChange={(e) => setDraft({ ...draft, extension: e.target.value })} required />
          <Input label="Phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          <Input label="Department" value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })} />
          <Input label="Email" type="email" value={draft.email ?? ''} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          {formError ? <p role="alert" className="text-sm text-danger">{formError}</p> : null}
        </form>
      </Modal>
    </div>
  )
}
