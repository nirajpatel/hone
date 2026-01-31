import { Brew, Coffee, User } from '../types';
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

interface BrewsTableProps {
  brews: Brew[];
  coffees: Coffee[];
  users: User[];
  onEdit?: (brew: Brew) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (brew: Brew) => void;
}

export function BrewsTable({
  brews,
  coffees,
  users,
  onEdit,
  onDelete,
  onDuplicate,
}: BrewsTableProps) {
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
          {brews.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                No brews found.
              </TableCell>
            </TableRow>
          ) : (
            brews.map((brew) => {
              const coffee = getCoffee(brew.coffeeId);
              const user = getUser(brew.userId);

              return (
                <TableRow key={brew.id} className="hover:bg-gray-50">
                  <TableCell className="px-6 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatDate(brew.createdAt)}</div>
                    <div className="text-xs text-gray-500">{formatTime(brew.createdAt)}</div>
                  </TableCell>
                  <TableCell className="px-6 whitespace-nowrap text-sm text-gray-900">
                    {user?.name || 'Unknown'}
                  </TableCell>
                  <TableCell className="px-6 text-sm text-gray-900">
                    {brew.roaster}
                  </TableCell>
                  <TableCell className="px-6 text-sm text-gray-900">
                    {brew.coffeeName}
                  </TableCell>
                  <TableCell className="px-6 whitespace-nowrap text-sm text-gray-900">
                    {capitalizeBrewMethod(brew.brewMethod)}
                  </TableCell>
                  <TableCell className="px-6">
                    <div className="flex justify-center">
                      <InteractiveStarRating
                        rating={brew.quality}
                        size="sm"
                        readOnly
                      />
                    </div>
                  </TableCell>
                  <TableCell className="px-6 text-sm text-gray-600">
                    {brew.tastingNotes || brew.notes || '-'}
                  </TableCell>
                  <TableCell className="px-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
                        <MoreVertical className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onEdit && (
                          <DropdownMenuItem onClick={() => onEdit(brew)}>
                            <Pencil className="w-4 h-4" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {onDuplicate && (
                          <DropdownMenuItem onClick={() => onDuplicate(brew)}>
                            <Copy className="w-4 h-4" />
                            Duplicate
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <DropdownMenuItem 
                            onClick={() => onDelete(brew.id)}
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