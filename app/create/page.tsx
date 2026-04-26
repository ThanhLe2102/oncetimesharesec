import { CreateSecretForm } from "@/components/CreateSecretForm";

type Props = {
  searchParams: Promise<{ pair?: string }>;
};

export default async function CreatePage({ searchParams }: Props) {
  const pair = (await searchParams).pair;
  return <CreateSecretForm initialPairingToken={pair} />;
}
