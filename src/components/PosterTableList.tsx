'use client'

import * as React from 'react'
import {
  ColumnDef,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
} from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import PosterThumb from '@/components/PosterThumb'
import type { PosterItem } from '@/app/posters/page'

type Props = {
  items: PosterItem[]
  loading?: boolean
  onDownloadAll: () => void
  downloadingZip?: boolean
  onGenerateAI: (item: PosterItem) => void
  generatingIds?: string[] | null    // ⬅️ liste d’IDs en cours
}

const THUMB_W = 128
const THUMB_H = 192

export function PosterDataTable({
  items,
  loading,
  onDownloadAll,
  downloadingZip,
  onGenerateAI,
  generatingIds,
}: Props) {
  // Set pour lookup O(1)
  const genSet = React.useMemo(() => new Set(generatingIds ?? []), [generatingIds])

  const columns = React.useMemo<ColumnDef<PosterItem>[]>(() => [
    {
      accessorKey: 'title',
      header: () => <div className="text-left w-full">Programme</div>,
      cell: ({ row }) => {
        const it = row.original
        const title = it.title?.trim() || (it.imdbId ? `IMDb ${it.imdbId}` : `Ligne ${it.row}`)
        return (
          <div className="min-w-0 text-left">
            <div className="font-medium text-sm truncate">{title}</div>
            <div className="text-xs text-muted-foreground">
              {it.imdbId ? `ID: ${it.imdbId}` : `Ligne ${it.row}`}
              {it.error ? ` • ${it.error}` : ''}
              {it.source ? ` • Source: ${it.source.toUpperCase()}` : ''}
            </div>
          </div>
        )
      },
      enableSorting: true,
    },
    {
      id: 'status',
      header: () => <div className="w-full text-center">Statut</div>,
      cell: ({ row }) => {
        const it = row.original
        const Pill = (props: { className: string; children: React.ReactNode }) => (
          <span
            className={`inline-flex items-center justify-center rounded-full border text-xs font-medium px-2.5 py-0.5 ${props.className}`}
          >
            {props.children}
          </span>
        )

        if (!it.imdbId) {
          return (
            <div className="flex justify-center">
              <Pill className="bg-red-100 text-red-800 border-red-300">IMDb manquant</Pill>
            </div>
          )
        }

        if (it.posterUrl) {
          const label = it.source === 'ai' ? 'IA OK' : 'IMDb OK'
          const styles =
            it.source === 'ai'
              ? 'bg-purple-100 text-purple-800 border-purple-300'
              : 'bg-green-100 text-green-800 border-green-300'
          return (
            <div className="flex justify-center">
              <Pill className={styles}>{label}</Pill>
            </div>
          )
        }

        return (
          <div className="flex justify-center">
            <Pill className="bg-orange-100 text-orange-800 border-orange-300">Poster manquant</Pill>
          </div>
        )
      },
      enableSorting: false,
    },
    {
      id: 'poster',
      header: () => <div className="w-full text-center">Poster / Action</div>,
      cell: ({ row }) => {
        const it = row.original
        const title = it.title?.trim() || (it.imdbId ? `IMDb ${it.imdbId}` : `Ligne ${it.row}`)
        const rowId = it.id || String(it.row)
        const isLoading = genSet.has(rowId)          // ⬅️ loading par-ligne
        const hasPoster = Boolean(it.posterUrl)
        const isAI = it.source === 'ai'

        const maybeLinkWrap = (node: React.ReactNode) =>
          hasPoster ? (
            <a
              href={it.posterUrl}
              target="_blank"
              rel="noreferrer"
              title={`Ouvrir "${title}" en grand`}
              style={{ display: 'inline-block' }}
            >
              {node}
            </a>
          ) : (
            node
          )

        return (
          <div className="flex w-full items-center justify-center">
            <div className="flex flex-col items-center gap-2" style={{ width: THUMB_W }}>
              {hasPoster
                ? maybeLinkWrap(
                    <PosterThumb url={it.posterUrl} title={title} width={THUMB_W} height={THUMB_H} />
                  )
                : (
                  <div
                    style={{ width: THUMB_W, height: THUMB_H }}
                    className="bg-muted/30 rounded-md grid place-items-center text-xs text-muted-foreground"
                  >
                    Aucun poster
                  </div>
                )
              }

              {/* Boutons :
                  - Générer (IA) si source ≠ IA
                  - Régénérer (IA) si source = IA
                  - Désactivé + texte "Génération…" quand isLoading */}
              {!isAI && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onGenerateAI(it)}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Génération…' : 'Générer (IA)'}
                </Button>
              )}

              {isAI && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onGenerateAI(it)}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Régénération…' : 'Régénérer (IA)'}
                </Button>
              )}
            </div>
          </div>
        )
      },
      enableSorting: false,
    },
  ], [onGenerateAI, generatingIds]) // ← dépend de la liste pour refléter le loading

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageIndex: 0, pageSize: 25 },
      sorting: [{ id: 'title', desc: false }],
    },
  })

  return (
    <div className="w-full max-w-5xl mx-auto mt-8">
      <div className="flex items-center justify-between px-2 sm:px-4">
        <h2 className="text-base font-medium">Liste des programmes</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onDownloadAll}
          disabled={downloadingZip || items.every((i) => !i.posterUrl)}
        >
          {downloadingZip ? 'Préparation…' : 'Télécharger toutes les images'}
        </Button>
      </div>

      <div className="mt-10 overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className={h.id === 'title' ? 'text-left' : 'text-center'}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                  Chargement…
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                  Aucun résultat.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2 sm:px-4 py-3">
        <div className="text-muted-foreground hidden md:block text-sm">
          {table.getFilteredRowModel().rows.length} éléments
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            ‹
          </Button>
          <div className="text-sm tabular-nums">
            Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            ›
          </Button>
        </div>
      </div>
    </div>
  )
}
