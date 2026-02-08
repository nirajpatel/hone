import { useState, useEffect } from 'react';
import { Equipment, EquipmentType, BrewMethod } from '../types';
import { Button } from './ui/button';
import { StandardDialog } from './ui/standard-dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Plus, Star, Trash2, MoreVertical, Edit2, Power } from 'lucide-react';
import { BrewEquipmentIcon } from './icons/BrewEquipmentIcon';
import { GrinderIcon } from './icons/GrinderIcon';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import {capitalizeBrewMethod, formatEquipmentName } from '../utils/formatters';
import { getAllBrewMethodConfigs } from '../utils/brewMethods';
import { toast } from 'sonner@2.0.3';
import { projectId } from '../utils/supabase/info';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { sanitizeErrorMessage } from '../utils/errorHandling';

interface EquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessToken: string;
  onEquipmentChange?: () => void;
}

export function EquipmentDialog({
  open,
  onOpenChange,
  accessToken,
  onEquipmentChange,
}: EquipmentDialogProps) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<EquipmentType | null>(null);
  const [addingType, setAddingType] = useState<EquipmentType | null>(null);
  const [formData, setFormData] = useState<{
    company: string;
    model: string;
    method: BrewMethod; // Used for brewers
    methods: BrewMethod[]; // Used for grinders
  }>({
    company: '',
    model: '',
    method: 'espresso' as BrewMethod,
    methods: ['espresso'], // Default to espresso for grinders
  });
  const [saving, setSaving] = useState(false);

  const apiUrl = `https://${projectId}.supabase.co/functions/v1/make-server-23508aac`;

  useEffect(() => {
    if (open) {
      loadEquipment();
    }
  }, [open]);

  const loadEquipment = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/equipment`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to load equipment:', response.status, errorData);
        throw new Error(errorData.error || 'Failed to load equipment');
      }

      const data = await response.json();
      console.log('Equipment loaded successfully:', data);
      setEquipment(data);
    } catch (error) {
      console.error('Error loading equipment:', error);
      toast.error('Failed to load equipment');
      setEquipment([]); // Set to empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (type: EquipmentType) => {
    if (!formData.company.trim() || !formData.model.trim()) {
      toast.error('Please enter a company and model');
      return;
    }

    // For grinders, validate at least one method is selected
    if (type === 'grinder' && formData.methods.length === 0) {
      toast.error('Please select at least one brew method');
      return;
    }

    try {
      setSaving(true);

      const wasEditing = !!editingId;
      const savedFormData = { ...formData };
      const savedEditingId = editingId;

      // Make the actual API call
      const url = wasEditing
        ? `${apiUrl}/equipment/${editingId}`
        : `${apiUrl}/equipment`;

      const response = await fetch(url, {
        method: wasEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          company: savedFormData.company,
          model: savedFormData.model,
          type: type,
          // Send methods array for grinders, single method for brewers
          ...(type === 'grinder' ? { methods: savedFormData.methods } : { method: savedFormData.method }),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save equipment');
      }

      const savedEquipment = await response.json();
      
      // Refresh equipment list to get latest server state
      await loadEquipment();

      toast.success(wasEditing ? 'Equipment updated successfully' : 'Equipment added successfully');
      
      // Close form and reset AFTER save completes
      setFormData({ company: '', model: '', method: 'espresso', methods: ['espresso'] });
      setEditingId(null);
      setEditingType(null);
      setAddingType(null);
      
      if (onEquipmentChange) {
        onEquipmentChange();
      }
    } catch (error) {
      console.error('Error saving equipment:', error);
      toast.error(sanitizeErrorMessage(error, 'Failed to save equipment'));
      // Reload on error to revert optimistic update
      loadEquipment();
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: Equipment) => {
    setEditingId(item.id);
    setEditingType(item.type);
    setFormData({
      company: item.company || '',
      model: item.model || '',
      method: item.method,
      // If item has methods array, use it; otherwise fallback to single method
      methods: item.methods || [item.method],
    });
    setAddingType(null);
  };

  const handleToggleActive = async (item: Equipment) => {
    try {
      // Optimistic update
      setEquipment(prev => prev.map(e => 
        e.id === item.id ? { ...e, active: !e.active } : e
      ));

      const response = await fetch(`${apiUrl}/equipment/${item.id}/toggle-active`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to update equipment');
      }

      toast.success(item.active ? 'Equipment deactivated' : 'Equipment activated');
      if (onEquipmentChange) {
        onEquipmentChange();
      }
    } catch (error) {
      console.error('Error toggling equipment:', error);
      toast.error('Failed to update equipment');
      // Revert optimistic update on error
      loadEquipment();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this equipment? Past extractions will retain this equipment name for historical records.')) {
      return;
    }

    try {
      // Optimistic update
      setEquipment(prev => prev.filter(e => e.id !== id));

      const response = await fetch(`${apiUrl}/equipment/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete equipment');
      }

      toast.success('Equipment deleted successfully');
      if (onEquipmentChange) {
        onEquipmentChange();
      }
    } catch (error) {
      console.error('Error deleting equipment:', error);
      toast.error('Failed to delete equipment');
      // Revert optimistic update on error
      loadEquipment();
    }
  };

  const handleSetPrimary = async (id: string, method: BrewMethod) => {
    try {
      // Find the equipment item
      const item = equipment.find(e => e.id === id);
      if (!item) return;

      // Optimistic update - update primaryForMethods for all equipment of same type
      setEquipment(prev => prev.map(e => {
        if (e.type !== item.type) return e;
        
        const equipmentMethods = e.methods || [e.method];
        
        // Only update if this equipment supports the method
        if (!equipmentMethods.includes(method)) return e;
        
        if (e.id === id) {
          // Add method to primaryForMethods
          const existingPrimaryForMethods = e.primaryForMethods || (e.primary ? [e.method] : []);
          const updatedPrimaryForMethods = [...new Set([...existingPrimaryForMethods, method])];
          return { 
            ...e, 
            primaryForMethods: updatedPrimaryForMethods,
            primary: true 
          };
        } else {
          // Remove method from primaryForMethods
          const existingPrimaryForMethods = e.primaryForMethods || (e.primary && e.method === method ? [e.method] : []);
          const updatedPrimaryForMethods = existingPrimaryForMethods.filter(m => m !== method);
          return { 
            ...e, 
            primaryForMethods: updatedPrimaryForMethods,
            primary: updatedPrimaryForMethods.length > 0 
          };
        }
      }));

      const response = await fetch(`${apiUrl}/equipment/${id}/primary?method=${method}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to set equipment as primary');
      }

      toast.success('Equipment set as primary');
      if (onEquipmentChange) {
        onEquipmentChange();
      }
    } catch (error) {
      console.error('Error setting equipment as primary:', error);
      toast.error('Failed to set equipment as primary');
      // Revert optimistic update on error
      loadEquipment();
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingType(null);
    setAddingType(null);
    setFormData({ company: '', model: '', method: 'espresso', methods: ['espresso'] });
  };

  const startAdding = (type: EquipmentType) => {
    setAddingType(type);
    setEditingId(null);
    setEditingType(null);
    setFormData({ company: '', model: '', method: 'espresso', methods: ['espresso'] });
  };

  const brewers = equipment.filter(e => e.type === 'brewer');
  const grinders = equipment.filter(e => e.type === 'grinder');

  const renderAddForm = (type: EquipmentType) => {
    const isAdding = addingType === type;
    const isEditing = editingType === type && editingId !== null;
    const showForm = isAdding || isEditing;

    if (!showForm) return null;

    // Set placeholders based on method and type
    let companyPlaceholder = '';
    let modelPlaceholder = '';
    
    if (formData.method === 'espresso' || (type === 'grinder' && formData.methods.includes('espresso'))) {
      companyPlaceholder = type === 'brewer' ? 'Breville' : 'Niche';
      modelPlaceholder = type === 'brewer' ? 'Dual Boiler' : 'Zero';
    } else if (formData.method === 'pour over' || (type === 'grinder' && formData.methods.includes('pour over'))) {
      companyPlaceholder = type === 'brewer' ? 'Hario' : 'Fellow';
      modelPlaceholder = type === 'brewer' ? 'V60' : 'Ode Brew Grinder Gen 2';
    } else if (formData.method === 'immersion' || (type === 'grinder' && formData.methods.includes('immersion'))) {
      companyPlaceholder = type === 'brewer' ? 'AeroPress' : 'Baratza';
      modelPlaceholder = type === 'brewer' ? 'Original' : 'Encore ESP';
    }

    const toggleMethod = (method: BrewMethod) => {
      setFormData(prev => ({
        ...prev,
        methods: prev.methods.includes(method)
          ? prev.methods.filter(m => m !== method)
          : [...prev.methods, method]
      }));
    };

    return (
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(type);
          }}
          className="space-y-4"
        >
          {/* Method selection - single for brewers, multi for grinders */}
          {type === 'brewer' ? (
            <div>
              <Label htmlFor={`${type}-method`}>Method</Label>
              <Select
                value={formData.method}
                onValueChange={(value) => setFormData({ ...formData, method: value as BrewMethod })}
              >
                <SelectTrigger id={`${type}-method`} className="mt-2">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {getAllBrewMethodConfigs().map(config => (
                    <SelectItem key={config.id} value={config.id}>{config.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label>Brew Methods</Label>
              <div className="mt-2 space-y-2">
                {getAllBrewMethodConfigs().map(config => (
                  <div key={config.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`method-${config.id}`}
                      checked={formData.methods.includes(config.id as BrewMethod)}
                      onCheckedChange={() => toggleMethod(config.id as BrewMethod)}
                    />
                    <Label 
                      htmlFor={`method-${config.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {config.displayName}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor={`${type}-company`}>Company</Label>
            <Input
              id={`${type}-company`}
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder={companyPlaceholder}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor={`${type}-model`}>Model</Label>
            <Input
              id={`${type}-model`}
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              placeholder={modelPlaceholder}
              className="mt-2"
            />
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={cancelEdit}
              className="cursor-pointer flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="cursor-pointer flex-1">
              {saving ? 'Saving...' : isEditing ? 'Update' : `Add ${type === 'brewer' ? 'Brewer' : 'Grinder'}`}
            </Button>
          </div>
        </form>
      </div>
    );
  };

  const renderEquipmentSection = (type: EquipmentType, items: Equipment[], title: string) => {
    const isAdding = addingType === type;
    const isEditing = editingType === type && editingId !== null;
    const showForm = isAdding || isEditing;

    // Group items by method dynamically
    const brewMethodConfigs = getAllBrewMethodConfigs();
    const itemsByMethod = brewMethodConfigs.map(config => ({
      method: config,
      items: items.filter(item => {
        // For items with methods array (grinders)
        if (item.methods) {
          return item.methods.includes(config.id as BrewMethod);
        }
        // For items with single method (brewers or legacy grinders)
        return item.method === config.id;
      })
    })).filter(group => group.items.length > 0);

    // Sort function: primary first, then alphabetically by name
    const sortEquipment = (a: Equipment, b: Equipment) => {
      if (a.primary && !b.primary) return -1;
      if (!a.primary && b.primary) return 1;
      const aName = formatEquipmentName(a);
      const bName = formatEquipmentName(b);
      return aName.localeCompare(bName);
    };

    return (
      <div>
        <div className="flex items-center justify-between mb-4 equipment-section-header">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => startAdding(type)}
            className="cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>

        {renderAddForm(type)}

        <div className="space-y-4">
          {items.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">
              No {type}s added yet
            </p>
          ) : (
            <>
              {itemsByMethod.map(({ method, items: methodItems }) => {
                const sortedItems = [...methodItems].sort(sortEquipment);
                
                return (
                  <div key={method.id}>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">{method.displayName}</h4>
                    <div className="space-y-2">
                      {sortedItems.map((item) => {
                        // Check if item supports multiple methods
                        const itemMethods = item.methods || [item.method];
                        const supportsMultipleMethods = itemMethods.length > 1;
                        
                        // Check if this item is primary for the current method
                        const primaryForMethods = item.primaryForMethods || (item.primary ? [item.method] : []);
                        const isPrimaryForCurrentMethod = primaryForMethods.includes(method.id as BrewMethod);
                        
                        return (
                          <div
                            key={item.id}
                            className={`equipment-card flex items-center justify-between py-2 px-3 rounded-lg border ${
                              item.active 
                                ? 'bg-white border-gray-200' 
                                : 'bg-gray-50 border-gray-200 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`text-sm ${item.active ? 'text-gray-900' : 'text-gray-500'}`}>
                                {formatEquipmentName(item)}
                              </span>
                              {supportsMultipleMethods && (
                                <span className="text-xs text-gray-500">
                                  ({itemMethods.map(m => capitalizeBrewMethod(m)).join(', ')})
                                </span>
                              )}
                              {isPrimaryForCurrentMethod && (
                                <Badge variant="outline" className="text-xs px-2 py-0 h-6 font-normal">
                                  Primary
                                </Badge>
                              )}
                              {!item.active && (
                                <span className="text-xs text-gray-500">(Inactive)</span>
                              )}
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="cursor-pointer h-7 w-7 p-0"
                                >
                                  <MoreVertical className="w-4 h-4 text-gray-900" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => handleEdit(item)} className="cursor-pointer">
                                  <Edit2 className="w-4 h-4 mr-2 text-gray-900" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleToggleActive(item)} className="cursor-pointer">
                                  <Power className="w-4 h-4 mr-2 text-gray-900" />
                                  {item.active ? 'Deactivate' : 'Activate'}
                                </DropdownMenuItem>
                                {!isPrimaryForCurrentMethod && (
                                  <DropdownMenuItem 
                                    onSelect={() => handleSetPrimary(item.id, method.id as BrewMethod)} 
                                    className="cursor-pointer"
                                  >
                                    <Star className="w-4 h-4 mr-2 text-gray-900" />
                                    Use as primary
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem 
                                  onSelect={() => handleDelete(item.id)} 
                                  className="cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4 mr-2 text-gray-900" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <StandardDialog 
      open={open} 
      onOpenChange={onOpenChange}
      title="Equipment Management"
      maxHeight="85vh"
    >
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading equipment...</div>
      ) : (
        <div className="space-y-8 mt-0">
          {renderEquipmentSection('brewer', brewers, 'Brewers')}
          {renderEquipmentSection('grinder', grinders, 'Grinders')}
        </div>
      )}
    </StandardDialog>
  );
}