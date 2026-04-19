import { ReceiveSecretView } from "@/components/ReceiveSecretView";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SecretPage({ params }: Props) {
  const { id } = await params;
  return <ReceiveSecretView secretId={id} />;
}
