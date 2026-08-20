// Must-find cases (RF-UAW04): single-line named import, multi-line named
// import, and an aliased import reported under its real (DS-exported) name.
import { Card } from "@zevaui/components";
import {
  Button,
  Dialog,
} from "@zevaui/components";
import { Alert as MyAlert } from "@zevaui/components";

export function App() {
  return (
    <Card>
      <Button>Click</Button>
      <Dialog open={false} onClose={() => {}} />
      <MyAlert tone="warning">Careful</MyAlert>
    </Card>
  );
}
