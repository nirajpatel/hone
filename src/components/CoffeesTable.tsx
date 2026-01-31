import { Coffee, Extraction } from '../types';
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
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';

interface CoffeesTableProps {
  coffees: Coffee[];
  brews: Brew[];
  onEdit?: (coffee: Coffee) => void;
  onDelete?: (id: string) => void;
}

export function CoffeesTable({
  coffees,
  brews,
  onEdit,
  onDelete,
}: CoffeesTableProps) {
  const getExtractionCount = (coffeeId: string) => {
    return brews.filter(e => e.coffeeId === coffeeId).length;
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-6">Roaster</TableHead>
            <TableHead className="px-6">Coffee Name</TableHead>
            <TableHead className="px-6">Region</TableHead>
            <TableHead className="px-6">Roast Level</TableHead>
            <TableHead className="px-6">Roast Date</TableHead>
            <TableHead className="px-6 text-center">Extractions</TableHead>
            <TableHead className="px-6 w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {coffees.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                No coffees found.
              </TableCell>
            </TableRow>
          ) : (
            coffees.map((coffee) => {
              const extractionCount = getExtractionCount(coffee.id);

              return (
                <TableRow key={coffee.id} className="hover:bg-gray-50">
                  <TableCell className="px-6 text-sm text-gray-900 font-medium">
                    {coffee.roaster}
                  </TableCell>
                  <TableCell className="px-6 text-sm text-gray-900">
                    {coffee.name}
                  </TableCell>
                  <TableCell className="px-6 text-sm text-gray-600">
                    {coffee.region || '-'}
                  </TableCell>
                  <TableCell className="px-6 text-sm text-gray-600">
                    {coffee.roastLevel || '-'}
                  </TableCell>
                  <TableCell className="px-6 text-sm text-gray-600 whitespace-nowrap">
                    {formatDate(coffee.roastDate)}
                  </TableCell>
                  <TableCell className="px-6 text-sm text-gray-900 text-center">
                    {extractionCount}
                  </TableCell>
                  <TableCell className="px-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
                        <MoreVertical className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onEdit && (
                          <DropdownMenuItem onClick={() => onEdit(coffee)}>
                            <Pencil className="w-4 h-4" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <DropdownMenuItem 
                            onClick={() => onDelete(coffee.id)}
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
