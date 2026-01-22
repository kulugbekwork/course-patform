import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Plus, X, Trash2 } from 'lucide-react';

interface Test {
  id: string;
  title: string;
  description: string | null;
}

export default function TestPlaylistForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [stage, setStage] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [accessMode, setAccessMode] = useState<'any' | 'sequential'>('sequential');
  const [availableTests, setAvailableTests] = useState<Test[]>([]);
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [testOrders, setTestOrders] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile?.id) {
      loadAvailableTests();
      if (id) {
        loadPlaylist();
      }
    }
  }, [profile?.id, id]);

  const loadAvailableTests = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('tests')
        .select('id, title, description')
        .eq('teacher_id', profile?.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      if (data) setAvailableTests(data);
    } catch (err: any) {
      console.error('Error loading tests:', err);
    }
  };

  const loadPlaylist = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: playlistData, error: playlistError } = await supabase
        .from('playlists')
        .select('*')
        .eq('id', id)
        .eq('teacher_id', profile?.id)
        .single();

      if (playlistError) throw playlistError;
      if (playlistData) {
        setTitle(playlistData.title);
        setDescription(playlistData.description || '');
        setAccessMode(playlistData.access_mode || 'sequential');

        // Load playlist tests
        const { data: playlistTests, error: testsError } = await supabase
          .from('playlist_tests')
          .select('test_id, order_index')
          .eq('playlist_id', id)
          .order('order_index', { ascending: true });

        if (!testsError && playlistTests) {
          const testIds = playlistTests.map(pt => pt.test_id);
          setSelectedTestIds(testIds);
          const orders: { [key: string]: number } = {};
          playlistTests.forEach(pt => {
            orders[pt.test_id] = pt.order_index;
          });
          setTestOrders(orders);
        }
      }
    } catch (err: any) {
      console.error('Error loading playlist:', err);
      setError(err.message || 'Failed to load playlist');
    } finally {
      setLoading(false);
    }
  };

  const handleStage1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a playlist title');
      return;
    }
    setError('');
    setStage(2);
  };

  const toggleTestSelection = (testId: string) => {
    if (selectedTestIds.includes(testId)) {
      setSelectedTestIds(selectedTestIds.filter(id => id !== testId));
      const newOrders = { ...testOrders };
      delete newOrders[testId];
      setTestOrders(newOrders);
    } else {
      const newOrder = selectedTestIds.length;
      setSelectedTestIds([...selectedTestIds, testId]);
      setTestOrders({ ...testOrders, [testId]: newOrder });
    }
  };

  const updateTestOrder = (testId: string, newOrder: number) => {
    setTestOrders({ ...testOrders, [testId]: newOrder });
  };

  const removeTest = (testId: string) => {
    setSelectedTestIds(selectedTestIds.filter(id => id !== testId));
    const newOrders = { ...testOrders };
    delete newOrders[testId];
    setTestOrders(newOrders);
  };

    const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTestIds.length === 0) {
      setError('Please add at least one test to the playlist');
      return;
    }
    setError('');
    setLoading(true);

    try {
      if (id) {
        // Update existing playlist
        const { error: updateError } = await supabase
          .from('playlists')
          .update({
            title,
            description: description || null,
            access_mode: accessMode,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('teacher_id', profile?.id);

        if (updateError) throw updateError;

        // Delete existing playlist_tests
        await supabase
          .from('playlist_tests')
          .delete()
          .eq('playlist_id', id);

        // Insert new playlist_tests
        const playlistTestsToInsert = selectedTestIds.map(testId => ({
          playlist_id: id,
          test_id: testId,
          order_index: testOrders[testId] || 0,
        }));

        const { error: testsError } = await supabase
          .from('playlist_tests')
          .insert(playlistTestsToInsert);

        if (testsError) throw testsError;
      } else {
        // Create new playlist
        const { data: playlistData, error: insertError } = await supabase
          .from('playlists')
          .insert({
            title,
            description: description || null,
            teacher_id: profile?.id,
            access_mode: accessMode,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        if (!playlistData) throw new Error('Failed to create playlist');

        // Insert playlist_tests
        const playlistTestsToInsert = selectedTestIds.map(testId => ({
          playlist_id: playlistData.id,
          test_id: testId,
          order_index: testOrders[testId] || 0,
        }));

        const { error: testsError } = await supabase
          .from('playlist_tests')
          .insert(playlistTestsToInsert);

        if (testsError) throw testsError;
      }

      navigate('/teacher/dashboard');
    } catch (err: any) {
      console.error('Error saving playlist:', err);
      setError(err.message || 'Failed to save playlist. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getSelectedTests = () => {
    return availableTests
      .filter(test => selectedTestIds.includes(test.id))
      .sort((a, b) => {
        const orderA = testOrders[a.id] ?? 0;
        const orderB = testOrders[b.id] ?? 0;
        return orderA - orderB;
      });
  };

  if (loading && id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/teacher/dashboard')}
                className="flex items-center justify-center text-black hover:text-gray-600 transition"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex flex-col gap-3">
              <h2 className="text-xl font-bold text-black">
                {id ? 'Edit Test Playlist' : 'Create Test Playlist'}
              </h2>
              <div className="w-full relative">
                <div className="flex mb-1">
                  <span className={`text-sm font-medium ${stage >= 1 ? 'text-black' : 'text-gray-400'}`}>1</span>
                  <span className={`text-sm font-medium absolute left-1/2 transform -translate-x-1/2 ${stage === 2 ? 'text-black' : 'text-gray-400'}`}>2</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-black transition-all"
                    style={{ width: `${(stage / 2) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className={`text-xs ${stage >= 1 ? 'text-black' : 'text-gray-400'}`}></span>
                  <span className={`text-xs ${stage === 2 ? 'text-black' : 'text-gray-400'}`}></span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6">

          {stage === 1 ? (
            <form onSubmit={handleStage1Submit} className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Test Playlist Title *
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-black focus:border-black"
                  placeholder="Enter playlist title"
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-black focus:border-black"
                  placeholder="Enter playlist description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Mode *
                </label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="accessMode"
                      value="sequential"
                      checked={accessMode === 'sequential'}
                      onChange={(e) => setAccessMode(e.target.value as 'sequential')}
                      className="text-black focus:ring-black"
                    />
                    <span className="text-sm">Sequential - Students solve tests one by one</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="accessMode"
                      value="any"
                      checked={accessMode === 'any'}
                      onChange={(e) => setAccessMode(e.target.value as 'any')}
                      className="text-black focus:ring-black"
                    />
                    <span className="text-sm">Any - Students can solve any test they want</span>
                  </label>
                </div>
              </div>

              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition"
                >
                  Next
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleFinalSubmit} className="space-y-6">
              <div>
                <label htmlFor="testSelect" className="block text-sm font-medium text-gray-700 mb-2">
                  Add Test
                </label>
                {availableTests.length === 0 ? (
                  <p className="text-gray-600">No tests available. Create a test first.</p>
                ) : (
                  <select
                    id="testSelect"
                    value=""
                    onChange={(e) => {
                      const testId = e.target.value;
                      if (testId && !selectedTestIds.includes(testId)) {
                        toggleTestSelection(testId);
                        e.target.value = ''; // Reset dropdown
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition"
                  >
                    <option value="">Select a test to add...</option>
                    {availableTests
                      .filter(test => !selectedTestIds.includes(test.id))
                      .map((test) => (
                        <option key={test.id} value={test.id}>
                          {test.title}
                        </option>
                      ))}
                  </select>
                )}
              </div>

              {selectedTestIds.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-black mb-4">
                    Selected Tests
                  </h3>
                  <div className="space-y-2">
                    {getSelectedTests().map((test, index) => (
                      <div
                        key={test.id}
                        className="p-3 border border-black rounded-lg bg-gray-50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-black">
                              {index + 1}. {test.title}
                            </div>
                            {test.description && (
                              <div className="text-sm text-gray-600 mt-1">{test.description}</div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeTest(test.id)}
                            className="ml-4 text-red-600 hover:text-red-800 transition"
                            title="Remove test"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStage(1)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || selectedTestIds.length === 0}
                  className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : id ? 'Update Playlist' : 'Create Playlist'}
                </button>
              </div>
            </form>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
