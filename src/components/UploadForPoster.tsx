// src/components/UploadForPoster.tsx
'use client'

import * as React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Props = {
  onFileSelected: (file: File | null) => void
  onSubmit: () => void
  disabled?: boolean
  loading?: boolean
}

export function UploadForPoster({ onFileSelected, onSubmit, disabled, loading }: Props) {
  return (
    <Card className="max-w-xl mx-auto mt-10 p-6"> {/* 👈 même style que UploadForm */}
      <CardHeader className="pb-4">
        <CardTitle>Charger un fichier producteur</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="baseFile">Excel (.xlsx)</Label>
          <Input
            id="baseFile"
            type="file"
            accept=".xlsx"
            onChange={(e) => onFileSelected(e.target.files?.[0] || null)}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={onSubmit} disabled={disabled || loading}>
            {loading ? 'Chargement…' : 'Charger les posters'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
