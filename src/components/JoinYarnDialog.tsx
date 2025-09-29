import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface JoinYarnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const JoinYarnDialog = ({ open, onOpenChange }: JoinYarnDialogProps) => {
  const [yarnCode, setYarnCode] = useState("");
  const navigate = useNavigate();

  const handleJoin = () => {
    if (yarnCode.trim()) {
      navigate(`/meeting/${yarnCode.trim()}`);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-yarn-dark">Join a Yarn</DialogTitle>
          <DialogDescription>
            Enter the yarn code to join an existing meeting.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="yarnCode">Yarn Code</Label>
            <Input
              id="yarnCode"
              placeholder="Enter yarn code..."
              value={yarnCode}
              onChange={(e) => setYarnCode(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleJoin}
              className="bg-yarn-blue/20 text-yarn-dark border border-yarn-dark hover:bg-yarn-blue/30"
              disabled={!yarnCode.trim()}
            >
              Join Yarn
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JoinYarnDialog;