import React, { useEffect, useState } from 'react';
import { PageHeader, PrimaryButton, StatusBadge, PriorityBadge, Modal, FormSelect, Loading, EmptyState, SearchFilter } from '../components/UIComponents';
import * as api from '../services/api';

interface DistributionPlansProps { userRole?: string; }
export default function DistributionPlans({ userRole = 'admin' }: DistributionPlansProps) {
  const [distributions, setDistributions] = useState<any[]>([]);
  const [camps, setCamps] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({ 
    camp_id: '', 
    priority_level: 'Medium', 
    delivery_method: 'truck', 
    notes: '', 
    item_list: [{ item_name: '', item_type: 'food', quantity: 0, unit: 'units' }] 
  });

  const role = userRole?.toLowerCase() || 'user';
  const isAdmin = role === 'admin' || role === 'disaster_officer' || role === 'camp_coordinator';

  const load = () => {
    setLoading(true);
    Promise.all([api.getDistributions(), api.getCamps(), api.getResources()])
      .then(([d, c, r]) => { 
        setDistributions(d.data || []); 
        setCamps(c.data || []); 
        setResources(r.data || []);
      })
      .catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async () => {
    try { await api.createDistribution(form); setShowModal(false); load(); }
    catch (err: any) { alert(err.message); }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try { await api.updateDistributionStatus(id, status); load(); }
    catch (err: any) { alert(err.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this distribution plan?')) return;
    await api.deleteDistribution(id); load();
  };

  const filtered = distributions.filter(d => {
    const campName = typeof d.camp_id === 'object' ? d.camp_id.camp_name : '';
    const matchSearch = campName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader title="Distribution Management" subtitle="Create and track ration distributions" icon="local_shipping"
        actions={isAdmin && <PrimaryButton onClick={() => { setForm({ camp_id: camps[0]?._id || '', priority_level: 'Medium', delivery_method: 'truck', notes: '', item_list: [{ item_name: resources[0]?.resource_name || '', item_type: resources[0]?.resource_type || 'food', quantity: 1, unit: resources[0]?.unit || 'units' }] }); setShowModal(true); }} icon="add">New Distribution</PrimaryButton>} />

      <SearchFilter searchTerm={search} onSearch={setSearch} placeholder="Search distributions...">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm">
          <option value="">All Status</option>
          <option value="Pending">Pending</option><option value="On the Way">On the Way</option>
          <option value="Delivered">Delivered</option><option value="Failed">Failed</option>
        </select>
      </SearchFilter>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', count: distributions.length, color: 'bg-blue-100 text-blue-700', icon: 'list' },
          { label: 'Pending', count: distributions.filter(d => d.status === 'Pending').length, color: 'bg-amber-100 text-amber-700', icon: 'schedule' },
          { label: 'On the Way', count: distributions.filter(d => d.status === 'On the Way').length, color: 'bg-cyan-100 text-cyan-700', icon: 'local_shipping' },
          { label: 'Delivered', count: distributions.filter(d => d.status === 'Delivered').length, color: 'bg-emerald-100 text-emerald-700', icon: 'check_circle' },
        ].map(s => (
          <div key={s.label} className={`${s.color} rounded-xl p-4 flex items-center gap-3`}>
            <span className="material-icons text-2xl">{s.icon}</span>
            <div><p className="text-xl font-bold">{s.count}</p><p className="text-xs">{s.label}</p></div>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="local_shipping" title="No distributions found" subtitle="Create a new distribution plan" />
      ) : (
        <div className="space-y-3">
          {filtered.map(d => {
            const campName = typeof d.camp_id === 'object' ? d.camp_id.camp_name : 'Unknown';
            const teamName = typeof d.assigned_team_id === 'object' ? d.assigned_team_id?.name : 'Unassigned';
            return (
              <div key={d._id} className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                      <span className="material-icons">local_shipping</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">{campName}</h3>
                      <p className="text-sm text-gray-500">Team: {teamName} | Method: {d.delivery_method}</p>
                      <p className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <PriorityBadge level={d.priority_level} />
                    <StatusBadge status={d.status} />
                  </div>
                </div>
                {d.item_list && d.item_list.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {d.item_list.map((item: any, i: number) => (
                      <span key={i} className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">{item.item_name}: {item.quantity} {item.unit}</span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  {isAdmin && d.status === 'Pending' && <button onClick={() => handleStatusUpdate(d._id, 'On the Way')} className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm hover:bg-blue-100 flex items-center gap-1"><span className="material-icons text-sm">local_shipping</span>Dispatch</button>}
                  {isAdmin && d.status === 'On the Way' && <button onClick={() => handleStatusUpdate(d._id, 'Delivered')} className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm hover:bg-emerald-100 flex items-center gap-1"><span className="material-icons text-sm">check_circle</span>Mark Delivered</button>}
                  {isAdmin && (d.status === 'Pending' || d.status === 'On the Way') && <button onClick={() => handleStatusUpdate(d._id, 'Failed')} className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-sm hover:bg-rose-100 flex items-center gap-1"><span className="material-icons text-sm">cancel</span>Failed</button>}
                  {isAdmin && <button onClick={() => handleDelete(d._id)} className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 text-sm hover:bg-gray-100 ml-auto"><span className="material-icons text-sm">delete</span></button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Distribution Plan" size="md">
        <div className="space-y-4">
          <FormSelect label="Camp" value={form.camp_id} onChange={v => setForm({ ...form, camp_id: v })} required
            options={camps.map(c => ({ value: c._id, label: c.camp_name }))} />
          <FormSelect label="Priority" value={form.priority_level} onChange={v => setForm({ ...form, priority_level: v })}
            options={[{ value: 'Low', label: 'Low' }, { value: 'Medium', label: 'Medium' }, { value: 'High', label: 'High' }]} />
          <FormSelect label="Delivery Method" value={form.delivery_method} onChange={v => setForm({ ...form, delivery_method: v })}
            options={[{ value: 'truck', label: 'Truck' }, { value: 'boat', label: 'Boat' }, { value: 'helicopter', label: 'Helicopter' }, { value: 'hand-delivery', label: 'Hand Delivery' }]} />
          
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <span className="material-icons text-sm">inventory</span> Distribution Items
            </h4>
            {form.item_list.map((item, index) => {
              const selectedRes = resources.find(r => r.resource_name === item.item_name);
              return (
                <div key={index} className="space-y-3 mb-4 pb-4 border-b border-gray-200 last:border-0 last:pb-0">
                  <FormSelect label="Select Resource" value={item.item_name} 
                    onChange={v => {
                      const res = resources.find(r => r.resource_name === v);
                      const newList = [...form.item_list];
                      newList[index] = { ...item, item_name: v, item_type: res?.resource_type || 'food', unit: res?.unit || 'units' };
                      setForm({ ...form, item_list: newList });
                    }}
                    options={resources.map(r => ({ value: r.resource_name, label: `${r.resource_name} (${r.available_quantity} ${r.unit} available)` }))} />
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                      <input type="number" value={item.quantity} 
                        onChange={e => {
                          const newList = [...form.item_list];
                          newList[index].quantity = Number(e.target.value);
                          setForm({ ...form, item_list: newList });
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-300 outline-none text-sm" />
                    </div>
                    <div className="w-24">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>
                      <input type="text" value={item.unit} readOnly className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-gray-500 outline-none text-sm" />
                    </div>
                  </div>
                  {selectedRes && item.quantity > selectedRes.available_quantity && (
                    <p className="text-xs text-rose-500 font-medium">Warning: Insufficient stock!</p>
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-300 outline-none" rows={2} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border text-gray-600 hover:bg-gray-50">Cancel</button>
          <PrimaryButton onClick={handleCreate} icon="add">Create</PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
