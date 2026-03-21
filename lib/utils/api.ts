import type {
  AutocompleteCommandInput,
  AutocompleteCommandOutput,
  GeoPlacesClient,
  GetPlaceCommandInput,
  GetPlaceCommandOutput,
  SuggestCommandInput,
  SuggestCommandOutput,
} from "@chaosity/location-client";
import { AutocompleteCommand, GetPlaceCommand, SuggestCommand } from "@chaosity/location-client";
import { useNotificationStore } from "../stores/notificationStore";

export const autocomplete = async (
  client: GeoPlacesClient,
  input: AutocompleteCommandInput,
): Promise<AutocompleteCommandOutput> => {
  try {
    const command = new AutocompleteCommand(input);
    return await client.send(command);
  } catch (error) {
    handleApiError(error, "autocomplete", "Address autocomplete");
    throw error;
  }
};

export const suggest = async (client: GeoPlacesClient, input: SuggestCommandInput): Promise<SuggestCommandOutput> => {
  try {
    const command = new SuggestCommand(input);
    return await client.send(command);
  } catch (error) {
    handleApiError(error, "suggest", "Address suggestions");
    throw error;
  }
};

export const getPlace = async (
  client: GeoPlacesClient,
  input: GetPlaceCommandInput,
): Promise<GetPlaceCommandOutput> => {
  try {
    const command = new GetPlaceCommand(input);
    return await client.send(command);
  } catch (error) {
    handleApiError(error, "get-place", "Place details");
    throw error;
  }
};

const handleApiError = (error: unknown, id: string, description: string) => {
  const { addNotification } = useNotificationStore.getState();
  const verb = description.endsWith("s") ? "are" : "is";

  const docsLink = "https://docs.chaosity.cloud/address-form";

  addNotification(
    {
      id: `${id}-error`,
      message: `${description} ${verb} currently unavailable.`,
      type: "error",
    },
    () => {
      console.error(`${description} failed. See ${docsLink} for troubleshooting.`, error);
    },
  );

  throw error;
};
