import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ProjectList } from './ProjectList';
import { CreateProjectModal } from './CreateProjectModal';
import { Button } from '@/components/ui/button';
import { Plus, Network } from 'lucide-react';
import { getProjects } from '@/services/orchestratorApi';
import type { Project } from '../../shared/types/orchestrator';
import { motion } from 'framer-motion';

export default function OrchestratorPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProjects();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleProjectClick = (projectId: string) => {
    navigate(`/orchestrator/projects/${projectId}`);
  };

  const handleProjectCreated = () => {
    setShowCreateModal(false);
    loadProjects();
  };

  return (
    <div className="min-h-screen bg-bg-3">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Network className="h-10 w-10 text-primary" />
                <h1 className="text-6xl font-bold font-[departureMono] text-accent">
                  ORCHESTRATOR
                </h1>
              </div>
              <p className="text-text-tertiary text-lg">
                Manage development projects, tickets, and team workflows
              </p>
            </div>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-primary hover:bg-primary/90 text-white"
              size="lg"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Project
            </Button>
          </div>

          {/* Project List */}
          <ProjectList
            projects={projects}
            loading={loading}
            error={error}
            onProjectClick={handleProjectClick}
            onRefresh={loadProjects}
          />
        </motion.div>
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleProjectCreated}
      />
    </div>
  );
}