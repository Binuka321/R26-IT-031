import React, { useEffect, useState } from 'react';
import { PageHeader, PrimaryButton, PriorityBadge, StatusBadge, Modal, FormInput, FormSelect, Loading, EmptyState, SearchFilter } from '../components/UIComponents';
import * as api from '../services/api';
import type { Camp, SafeZone } from '../types';

interface CampsProps { onViewCamp?: (id: string) => void; userRole?: string; }
export default function Camps({ onViewCamp, userRole = 'admin' }: CampsProps) {
  const [camps, setCamps] = useState<Camp[]>([]);
  const [zones, setZones] = useState<SafeZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterZone, setFilterZone] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  const role = userRole?.toLowerCase() || 'user';
  const isAdmin = role === 'admin' || role === 'disaster_officer';
  const [form, setForm] = useState({
    camp_name: '', safe_zone_id: '', latitude: 0, longitude: 0, population: 0,
    children_count: 0, elderly_count: 0, food_available: 0, water_available: 0,
    medicine_available: 0, sanitary_available: 0, disease_risk_level: 'Low',
    distance_from_distribution_center: 0, camp_capacity: 0, contact_person: '', contact_phone: ''
  });

  const load = () => {
    setLoading(true);
    Promise.all([api.getCamps(), api.getSafeZones()])
      .then(([c, z]) => { setCamps(c.data); setZones(z.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleSave = async () => {
    try {
      if (editId) await api.updateCamp(editId, form);
      else await api.createCamp(form);
      setShowModal(false); setEditId(null); load();
    } catch (err: any) { alert(err.message); }
  };

  const handleEdit = (c: Camp) => {
    const zoneId = typeof c.safe_zone_id === 'object' ? c.safe_zone_id._id : c.safe_zone_id;
    setForm({ camp_name: c.camp_name, safe_zone_id: zoneId, latitude: c.latitude, longitude: c.longitude,
      population: c.population, children_count: c.children_count, elderly_count: c.elderly_count,
      food_available: c.food_available, water_available: c.water_available, medicine_available: c.medicine_available,
      sanitary_available: c.sanitary_available, disease_risk_level: c.disease_risk_level,
      distance_from_distribution_center: c.distance_from_distribution_center, camp_capacity: c.camp_capacity,
      contact_person: c.contact_person, contact_phone: c.contact_phone });
    setEditId(c._id); setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this camp?')) return;
    await api.deleteCamp(id); load();
  };

  const openNewForm = () => {
    setEditId(null);
    setForm({ camp_name: '', safe_zone_id: zones[0]?._id || '', latitude: 0, longitude: 0, population: 0,
      children_count: 0, elderly_count: 0, food_available: 0, water_available: 0,
      medicine_available: 0, sanitary_available: 0, disease_risk_level: 'Low',
      distance_from_distribution_center: 0, camp_capacity: 0, contact_person: '', contact_phone: '' });
    setShowModal(true);
  };

  const filtered = camps.filter(c => {
    const matchSearch = c.camp_name.toLowerCase().includes(search.toLowerCase());
    const matchPriority = !filterPriority || c.priority_level === filterPriority;
    const zoneId = typeof c.safe_zone_id === 'object' ? c.safe_zone_id._id : c.safe_zone_id;
    const matchZone = !filterZone || zoneId === filterZone;
    return matchSearch && matchPriority && matchZone;
  });

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader title="Camp Management" subtitle={`${camps.length} camps across ${zones.length} safe zones`} icon="holiday_village"
        actions={isAdmin && <PrimaryButton onClick={openNewForm} icon="add">Add Camp</PrimaryButton>} />

      <SearchFilter searchTerm={search} onSearch={setSearch} placeholder="Search camps...">
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm">
          <option value="">All Priorities</option>
          <option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
        </select>
        <select value={filterZone} onChange={e => setFilterZone(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm">
          <option value="">All Zones</option>
          {zones.map(z => <option key={z._id} value={z._id}>{z.name}</option>)}
        </select>
      </SearchFilter>

      {filtered.length === 0 ? (
        <EmptyState icon="holiday_village" title="No camps found" subtitle="Add camps inside safe zones" />
      ) : (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Camp Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Safe Zone</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Population</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Priority</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Disease Risk</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const zoneName = typeof c.safe_zone_id === 'object' ? c.safe_zone_id.name : 'N/A';
                  return (
                    <tr key={c._id} className="border-b border-gray-50 hover:bg-cyan-50/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-gray-800">
                        <div className="flex items-center gap-2">
                          {c.safe_zone_id && (
                            <span className="text-blue-500" title="Safe Camp">
                              <span className="material-icons text-sm">star</span>
                            </span>
                          )}
                          {c.camp_name}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{zoneName}</td>
                      <td className="py-3 px-4 text-center">{c.population}</td>
                      <td className="py-3 px-4 text-center"><PriorityBadge level={c.priority_level} /></td>
                      <td className="py-3 px-4 text-center"><PriorityBadge level={c.disease_risk_level} /></td>
                      <td className="py-3 px-4 text-center"><StatusBadge status={c.status} /></td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex justify-center gap-1">
                          {onViewCamp && (
                            <button onClick={() => onViewCamp(c._id)} title="View Details" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"><span className="material-icons text-sm">visibility</span></button>
                          )}
                          {isAdmin && (
                            <>
                              <button onClick={() => handleEdit(c)} title="Edit" className="p-1.5 rounded-lg hover:bg-cyan-50 text-cyan-600"><span className="material-icons text-sm">edit</span></button>
                              <button onClick={() => handleDelete(c._id)} title="Delete" className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600"><span className="material-icons text-sm">delete</span></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Camp' : 'Add Camp'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormInput label="Camp Name" value={form.camp_name} onChange={v => setForm({ ...form, camp_name: v })} required />
          <FormSelect label="Safe Zone" value={form.safe_zone_id} onChange={v => setForm({ ...form, safe_zone_id: v })} required
            options={zones.map(z => ({ value: z._id, label: z.name }))} />
          <FormInput label="Latitude" value={form.latitude} onChange={v => setForm({ ...form, latitude: v })} type="number" required />
          <FormInput label="Longitude" value={form.longitude} onChange={v => setForm({ ...form, longitude: v })} type="number" required />
          <FormInput label="Population" value={form.population} onChange={v => setForm({ ...form, population: v })} type="number" min={0} />
          <FormInput label="Children Count" value={form.children_count} onChange={v => setForm({ ...form, children_count: v })} type="number" min={0} />
          <FormInput label="Elderly Count" value={form.elderly_count} onChange={v => setForm({ ...form, elderly_count: v })} type="number" min={0} />
          <FormInput label="Food Available" value={form.food_available} onChange={v => setForm({ ...form, food_available: v })} type="number" min={0} />
          <FormInput label="Water Available" value={form.water_available} onChange={v => setForm({ ...form, water_available: v })} type="number" min={0} />
          <FormInput label="Medicine Available" value={form.medicine_available} onChange={v => setForm({ ...form, medicine_available: v })} type="number" min={0} />
          <FormInput label="Sanitary Available" value={form.sanitary_available} onChange={v => setForm({ ...form, sanitary_available: v })} type="number" min={0} />
          <FormSelect label="Disease Risk" value={form.disease_risk_level} onChange={v => setForm({ ...form, disease_risk_level: v })}
            options={[{ value: 'Low', label: 'Low' }, { value: 'Medium', label: 'Medium' }, { value: 'High', label: 'High' }]} />
          <FormInput label="Distance from Center (km)" value={form.distance_from_distribution_center} onChange={v => setForm({ ...form, distance_from_distribution_center: v })} type="number" />
          <FormInput label="Camp Capacity" value={form.camp_capacity} onChange={v => setForm({ ...form, camp_capacity: v })} type="number" />
          <FormInput label="Contact Person" value={form.contact_person} onChange={v => setForm({ ...form, contact_person: v })} />
          <FormInput label="Contact Phone" value={form.contact_phone} onChange={v => setForm({ ...form, contact_phone: v })} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border text-gray-600 hover:bg-gray-50">Cancel</button>
          <PrimaryButton onClick={handleSave} icon="save">{editId ? 'Update' : 'Create'}</PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
