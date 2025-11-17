import React, { useState, useEffect, type ChangeEvent } from 'react';
import { LogOut, X, MapPin, Clock, Filter, Loader2, RefreshCw, Search } from 'lucide-react';
import type { DashboardProps, Incident } from '../types';
import { incidentsApi, INCIDENT_STATUS, URGENCY_LEVELS, STATUS_LABELS, URGENCY_LABELS, INCIDENT_TYPE_LABELS } from '../api';
import { useWebSocket, type Notification } from '../hooks/useWebSocket';
import NotificationsPanel from './NotificationsPanel';
import ToastContainer from './ToastContainer';

const AuthorityDashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [toasts, setToasts] = useState<Notification[]>([]);
  
  const getUrgencyWeight = (urgency: string): number => {
    const weights: Record<string, number> = {
      'critical': 4,
      'high': 3,
      'medium': 2,
      'low': 1
    };
    return weights[urgency] || 0;
  };

  const [filters, setFilters] = useState({
    floor: '',
    urgency: '',
    status: '',
    searchName: ''
  });
  const [searchInput, setSearchInput] = useState('');

  const {
    isConnected,
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    clearNotification,
  } = useWebSocket({
    userId: user.user_id,
    rol: user.rol,
    token: localStorage.getItem('access_token'),
    onNotification: (notification) => {
      setToasts(prev => [...prev, notification]);
      if (notification.type === 'nuevo_incidente' || notification.type === 'cambio_estado') {
        loadIncidents();
      }
    }
  });

  const removeToast = (toastId: string) => {
    setToasts(prev => prev.filter(t => t.id !== toastId));
  };

  const formatDate = (dateString: string | undefined): { timestamp: string; fecha: string } => {
    try {
      if (!dateString) {
        const now = new Date();
        return {
          timestamp: now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
          fecha: now.toISOString().split('T')[0]
        };
      }

      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        console.warn('Fecha inválida recibida:', dateString);
        const now = new Date();
        return {
          timestamp: now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
          fecha: now.toISOString().split('T')[0]
        };
      }

      return {
        timestamp: date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        fecha: date.toISOString().split('T')[0]
      };
    } catch (err) {
      console.error('Error formateando fecha:', err);
      const now = new Date();
      return {
        timestamp: now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        fecha: now.toISOString().split('T')[0]
      };
    }
  };

  const mapIncidentFromAPI = (inc: any): Incident => {
    const { timestamp, fecha } = formatDate(inc.created_at);
    
    return {
      id: inc.incident_id || 'unknown',
      tipo: INCIDENT_TYPE_LABELS[inc.type] || inc.type || 'Desconocido',
      urgencia: (URGENCY_LABELS[inc.urgency] || inc.urgency || 'Media') as 'Baja' | 'Media' | 'Alta' | 'Crítica',
      descripcion: inc.description || 'Sin descripción',
       createdAt: new Date(inc.created_at).getTime(),
      ubicacion: `Piso ${inc.floor || 0}${inc.ambient ? ' - ' + inc.ambient : ''}`,
      estado: (STATUS_LABELS[inc.status] || inc.status || 'Pendiente') as 'Pendiente' | 'En Atención' | 'Resuelto',
      timestamp,
      fecha,
      
      reportadoPor: inc.reported_by_name || inc.created_by || 'Desconocido',
      
      _raw: {
        floor: inc.floor,
        urgency: inc.urgency,
        status: inc.status,
        created_by: inc.created_by
      }
    };
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  const loadIncidents = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await incidentsApi.getAll();
      
      if (response.success && response.data) {
        const allIncidents = response.data.map(mapIncidentFromAPI);
        
        const filteredIncidents = allIncidents.filter(incident => {
          if (filters.floor && incident._raw?.floor !== parseInt(filters.floor)) {
            return false;
          }
          
          if (filters.urgency && incident._raw?.urgency !== filters.urgency) {
            return false;
          }
          
          if (filters.status && incident._raw?.status !== filters.status) {
            return false;
          }
          
          if (filters.searchName) {
            const searchTerm = filters.searchName.toLowerCase().trim();
            const reportedBy = (incident.reportadoPor || '').toLowerCase();
            
            if (!reportedBy.includes(searchTerm)) {
              return false;
            }
          }
          
          return true;
        });
        
        const sortedIncidents = filteredIncidents.sort((a, b) => {
          const urgencyA = getUrgencyWeight(a._raw?.urgency || 'low');
          const urgencyB = getUrgencyWeight(b._raw?.urgency || 'low');
          
          if (urgencyA !== urgencyB) {
            return urgencyB - urgencyA;
          }
          return b.createdAt! - a.createdAt!;
        });
        
        setIncidents(sortedIncidents);
      } else {
        setError(response.error || 'Error al cargar incidentes');
      }
    } catch (err) {
      console.error('Error cargando incidentes:', err);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSearchInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  const clearFilters = () => {
    setFilters({
      floor: '',
      urgency: '',
      status: '',
      searchName: ''
    });
    setSearchInput('');
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setFilters(prev => ({ ...prev, searchName: searchInput }));
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchInput]);

  useEffect(() => {
    if (!loading) {
      loadIncidents();
    }
  }, [filters.floor, filters.urgency, filters.status, filters.searchName]);

  const updateIncidentStatus = async (id: string, newStatus: string) => {
    setUpdating(true);
    setError('');
    
    try {
      const userId = user.user_id || localStorage.getItem('user_id') || 'admin';
      
      const response = await incidentsApi.updateStatus({
        incident_id: id,
        new_status: newStatus,
        user_id: userId
      });
      
      if (response.success) {
        await loadIncidents();
        setSelectedIncident(null);
      } else {
        setError(response.error || 'Error al actualizar el estado');
      }
    } catch (err) {
      console.error('Error actualizando estado:', err);
      setError('Error de conexión');
    } finally {
      setUpdating(false);
    }
  };

  const getUrgencyColor = (urgencia: string): string => {
    const colors: Record<string, string> = {
      'Baja': 'bg-green-100 text-green-800 border-green-200',
      'Media': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Alta': 'bg-orange-100 text-orange-800 border-orange-200',
      'Crítica': 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[urgencia] || colors['Media'];
  };

  const getStatusColor = (estado: string): string => {
    const colors: Record<string, string> = {
      'Pendiente': 'bg-gray-100 text-gray-800 border-gray-200',
      'En Atención': 'bg-cyan-100 text-cyan-800 border-cyan-200',
      'Resuelto': 'bg-green-100 text-green-800 border-green-200',
      'Rechazado': 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[estado] || colors['Pendiente'];
  };

  const totalIncidents = incidents.length;
  const resolved = incidents.filter(i => i.estado === 'Resuelto').length;
  const inProgress = incidents.filter(i => i.estado === 'En Atención').length;
  const pending = incidents.filter(i => i.estado === 'Pendiente').length;
  const activeFiltersCount = Object.values(filters).filter(v => v !== '').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header mejorado */}
      <header className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b-4 border-cyan-500 px-6 py-4 shadow-xl">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-xl p-3 shadow-lg">
              <div className="flex items-center">
                <span className="text-gray-900 text-2xl font-bold tracking-tight">Alerta</span>
                <span className="text-cyan-500 text-2xl font-bold tracking-tight">UTEC</span>
              </div>
            </div>
            <div className="border-l-2 border-gray-600 pl-4">
              <h1 className="text-2xl font-bold text-white tracking-tight">Panel de Control</h1>
              <p className="text-sm text-gray-300">Bienvenido, <span className="font-semibold">{user.nombre}</span> • <span className="text-cyan-400 font-semibold">{user.rol}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={loadIncidents}
              className="p-2.5 hover:bg-gray-700 rounded-lg transition-all duration-200 transform hover:scale-105"
              disabled={loading}
              title="Recargar incidentes"
            >
              <RefreshCw className={`w-6 h-6 text-gray-300 hover:text-white transition-colors ${loading ? 'animate-spin' : ''}`} />
            </button>
            
            <NotificationsPanel
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              onClearNotification={clearNotification}
              onClearAll={clearNotifications}
            />
            
            {!isConnected && (
              <div className="flex items-center gap-2 text-xs text-yellow-300 bg-yellow-900/30 px-3 py-2 rounded-lg border border-yellow-700 animate-pulse">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                Reconectando...
              </div>
            )}
            
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2.5 text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-all duration-200 font-medium"
            >
              <LogOut className="w-5 h-5" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-6 py-4 rounded-lg mb-6 flex items-center justify-between shadow-md">
            <span className="font-medium">{error}</span>
            <button 
              onClick={loadIncidents}
              className="underline hover:no-underline font-semibold"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Estadísticas mejoradas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-gray-900 hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1">
            <div className="text-gray-600 text-sm font-bold mb-2 uppercase tracking-wider">Total de Incidentes</div>
            <div className="text-4xl font-bold text-gray-900">{totalIncidents}</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500 hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1">
            <div className="text-gray-600 text-sm font-bold mb-2 uppercase tracking-wider">Resueltos</div>
            <div className="text-4xl font-bold text-green-600">{resolved}</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-cyan-500 hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1">
            <div className="text-gray-600 text-sm font-bold mb-2 uppercase tracking-wider">En Atención</div>
            <div className="text-4xl font-bold text-cyan-600">{inProgress}</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-500 hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1">
            <div className="text-gray-600 text-sm font-bold mb-2 uppercase tracking-wider">Pendientes</div>
            <div className="text-4xl font-bold text-orange-600">{pending}</div>
          </div>
        </div>

        {/* Panel de Filtros mejorado */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border-t-4 border-cyan-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-gray-900 to-gray-700 rounded-lg shadow-md">
                <Filter className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Filtros de Búsqueda</h3>
              {activeFiltersCount > 0 && (
                <span className="bg-cyan-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
                  {activeFiltersCount}
                </span>
              )}
            </div>
            <div className="flex gap-3">
              {activeFiltersCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="px-5 py-2.5 text-gray-600 hover:text-gray-900 font-semibold text-sm transition-colors"
                >
                  Limpiar filtros
                </button>
              )}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-6 py-2.5 bg-gradient-to-r from-gray-900 to-gray-700 hover:from-gray-800 hover:to-gray-600 text-white rounded-lg font-semibold text-sm transition-all duration-200 shadow-md hover:shadow-lg"
              >
                {showFilters ? 'Ocultar' : 'Mostrar'} filtros
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t-2 border-gray-200">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                  Piso
                </label>
                <select
                  name="floor"
                  value={filters.floor}
                  onChange={handleFilterChange}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  disabled={loading}
                >
                  <option value="">Todos</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(floor => (
                    <option key={floor} value={floor}>Piso {floor}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                  Urgencia
                </label>
                <select
                  name="urgency"
                  value={filters.urgency}
                  onChange={handleFilterChange}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  disabled={loading}
                >
                  <option value="">Todas</option>
                  <option value={URGENCY_LEVELS.LOW}>Baja</option>
                  <option value={URGENCY_LEVELS.MEDIUM}>Media</option>
                  <option value={URGENCY_LEVELS.HIGH}>Alta</option>
                  <option value={URGENCY_LEVELS.CRITICAL}>Crítica</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                  Estado
                </label>
                <select
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  disabled={loading}
                >
                  <option value="">Todos</option>
                  <option value={INCIDENT_STATUS.PENDING}>Pendiente</option>
                  <option value={INCIDENT_STATUS.IN_PROGRESS}>En Atención</option>
                  <option value={INCIDENT_STATUS.COMPLETED}>Resuelto</option>
                  <option value={INCIDENT_STATUS.REJECTED}>Rechazado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                  Buscar por nombre
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={handleSearchInputChange}
                    placeholder="Nombre del estudiante"
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    disabled={loading}
                  />
                </div>
                {searchInput && (
                  <p className="text-xs text-gray-500 mt-1 font-medium">
                    Buscando: "{searchInput}"
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Lista de Incidentes */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-gray-900">
              Todos los Incidentes
              <span className="text-cyan-600 text-2xl ml-3">
                ({incidents.length})
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-lg">
              <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mb-4" />
              <span className="text-gray-600 font-medium">Cargando incidentes...</span>
            </div>
          ) : incidents.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-16 text-center border-2 border-dashed border-gray-300">
              <div className="text-gray-400 mb-4">
                <Filter className="w-16 h-16 mx-auto" />
              </div>
              <h3 className="text-xl font-bold text-gray-700 mb-2">
                No se encontraron incidentes
              </h3>
              <p className="text-gray-500 mb-6">
                {activeFiltersCount > 0 
                  ? 'Intenta ajustar los filtros para ver más resultados'
                  : 'No hay incidentes registrados en el sistema'}
              </p>
              {activeFiltersCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {incidents.map((incident) => (
                <div key={incident.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition-all duration-200 border-l-4 border-cyan-500 transform hover:-translate-y-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-gray-900">{incident.tipo}</h3>
                      <span className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 ${getUrgencyColor(incident.urgencia)} shadow-sm`}>
                        {incident.urgencia}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 ${getStatusColor(incident.estado)} shadow-sm`}>
                        {incident.estado}
                      </span>
                      <button
                        onClick={() => setSelectedIncident(incident)}
                        className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
                      >
                        Cambiar Estado
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-700 mb-3 font-medium">{incident.descripcion}</p>
                  <p className="text-sm text-gray-600 mb-4 font-medium">
                    Reportado por: <span className="text-gray-900 font-bold">{incident.reportadoPor}</span>
                  </p>
                  <div className="flex items-center gap-6 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-cyan-500" />
                      <span className="font-medium">{incident.ubicacion}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-cyan-500" />
                      <span className="font-medium">{incident.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal mejorado */}
      {selectedIncident && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border-t-4 border-cyan-500">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Cambiar Estado</h2>
              <button
                onClick={() => setSelectedIncident(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={updating}
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="mb-6 space-y-2 bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700"><strong className="text-gray-900">Incidente:</strong> {selectedIncident.tipo}</p>
              <p className="text-gray-700"><strong className="text-gray-900">Ubicación:</strong> {selectedIncident.ubicacion}</p>
              <p className="text-gray-700"><strong className="text-gray-900">Reportado por:</strong> {selectedIncident.reportadoPor}</p>
              <p className="text-gray-700"><strong className="text-gray-900">Estado actual:</strong> {selectedIncident.estado}</p>
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm font-medium">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => updateIncidentStatus(selectedIncident.id, INCIDENT_STATUS.PENDING)}
                disabled={updating}
                className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                {updating ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Actualizando...
                  </span>
                ) : (
                  'Pendiente'
                )}
              </button>
              <button
                onClick={() => updateIncidentStatus(selectedIncident.id, INCIDENT_STATUS.IN_PROGRESS)}
                disabled={updating}
                className="w-full px-4 py-3 bg-cyan-100 hover:bg-cyan-200 text-cyan-800 font-bold rounded-lg transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                En Atención
              </button>
              <button
                onClick={() => updateIncidentStatus(selectedIncident.id, INCIDENT_STATUS.COMPLETED)}
                disabled={updating}
                className="w-full px-4 py-3 bg-green-100 hover:bg-green-200 text-green-800 font-bold rounded-lg transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                Resuelto
              </button>
              <button
                onClick={() => updateIncidentStatus(selectedIncident.id, INCIDENT_STATUS.REJECTED)}
                disabled={updating}
                className="w-full px-4 py-3 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded-lg transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                Rechazado
              </button>
            </div>

            <button
              onClick={() => setSelectedIncident(null)}
              disabled={updating}
              className="w-full mt-4 px-4 py-3 bg-white hover:bg-gray-50 text-gray-700 font-bold rounded-lg border-2 border-gray-300 transition-colors disabled:opacity-50 shadow-sm hover:shadow-md"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
};

export default AuthorityDashboard;