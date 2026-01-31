import { Extraction, Coffee, User } from '../types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { InteractiveStarRating } from './InteractiveStarRating';
import { MoreVertical, Pencil, Trash2, Copy } from 'lucide-react';
import { capitalizeBrewMethod } from '../utils/formatters';

interface ExtractionsTableProps {
  extractions: Extraction[];
  coffees: Coffee[];
  users: User[];
  onEdit?: (extraction: Extraction) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (extraction: Extraction) => void;
}

export function ExtractionsTable({
  extractions,
  coffees,
  users,
  onEdit,
  onDelete,
  onDuplicate,
}: ExtractionsTableProps) {
  const getCoffee = (coffeeId: string) => {
    return coffees.find(c => c.id === coffeeId);
  };

  const getUser = (userId: string) => {
    return users.find(u => u.id === userId);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-6">Date & Time</TableHead>
            <TableHead className="px-6">Barista</TableHead>
            <TableHead className="px-6">Roaster</TableHead>
            <TableHead className="px-6">Coffee Name</TableHead>
            <TableHead className="px-6">Method</TableHead>
            <TableHead className="px-6 w-40">Quality</TableHead>
            <TableHead className="px-6 min-w-48">Notes</TableHead>
            <TableHead className="px-6 w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {extractions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                No extractions found.
              </TableCell>
            </TableRow>
          ) : (
            extractions.map((extraction) => {
              const coffee = getCoffee(extraction.coffeeId);
              const user = getUser(extraction.userId);

              return (
                <TableRow key={extraction.id} className="hover:bg-gray-50">
                  <TableCell className="px-6 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatDate(extraction.createdAt)}</div>
                    <div className="text-xs text-gray-500">{formatTime(extraction.createdAt)}</div>
                  </TableCell>
                  <TableCell className="px-6 whitespace-nowrap text-sm text-gray-900">
                    {user?.name || 'Unknown'}
                  </TableCell>
                  <TableCell className="px-6 text-sm text-gray-900">
                    {extraction.roaster}
                  </TableCell>
                  <TableCell className="px-6 text-sm text-gray-900">
                    {extraction.coffeeName}
                  </TableCell>
                  <TableCell className="px-6 whitespace-nowrap text-sm text-gray-900">
                    {capitalizeBrewMethod(extraction.brewMethod)}
                  </TableCell>
                  <TableCell className="px-6">
                    <div className="flex justify-center">
                      <InteractiveStarRating
                        rating={extraction.quality}
                        size="sm"
                        readOnly
                      />
                    </div>
                  </TableCell>
                  <TableCell className="px-6 text-sm text-gray-600">
                    {extraction.tastingNotes || extraction.notes || '-'}
                  </TableCell>
                  <TableCell className="px-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
                        <MoreVertical className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onEdit && (
                          <DropdownMenuItem onClick={() => onEdit(extraction)}>
                            <Pencil className="w-4 h-4" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {onDuplicate && (
                          <DropdownMenuItem onClick={() => onDuplicate(extraction)}>
                            <Copy className="w-4 h-4" />
                            Duplicate
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <DropdownMenuItem 
                            onClick={() => onDelete(extraction.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}