import { EditSpkPage } from '../../../../../components/spk/SpkPages';

// C-15, DEC-126: Create SPK in edit mode for a draft; read only once it left Draft or Rejected.
export default async function EditSpkRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  return <EditSpkPage id={Number(id)} saved={saved === '1'} />;
}
