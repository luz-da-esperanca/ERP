import { useNavigate, useParams } from 'react-router';
import type { HttpProjects } from '../../projects/infra/http-projects';
import { PersonSelection } from '../../projects/presentation/enrollment-management';
import { Page, Panel, BackLink, textValue } from '../../../shared/ui';
export function LinkPersonPage({ projects }: { projects: HttpProjects }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  return (
    <>
      <BackLink to={`/families/${id}/members`} />
      <Page title="Vincular pessoa existente">
        <Panel>
          <p>
            Busque a pessoa cadastrada. O próximo passo permite conferir
            vínculos anteriores, datas e a família de destino antes de
            confirmar.
          </p>
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              const personId = textValue(
                new FormData(event.currentTarget),
                'personId',
              );
              if (personId)
                navigate(
                  `/people/${personId}/reconciliation?familyId=${encodeURIComponent(id)}`,
                );
            }}
          >
            <PersonSelection gateway={projects} label="Pessoa cadastrada" />
            <button className="button primary">
              Conferir vínculos da pessoa existente
            </button>
          </form>
        </Panel>
      </Page>
    </>
  );
}
