// This is a placeholder for the nova API client.

const mockApi = {
  list: (_options?: any) => Promise.resolve([]), // eslint-disable-line @typescript-eslint/no-explicit-any
  create: (data: any) => Promise.resolve(data), // eslint-disable-line @typescript-eslint/no-explicit-any
  bulkCreate: (data: any) => Promise.resolve(data), // eslint-disable-line @typescript-eslint/no-explicit-any
  update: (id: any, data: any) => Promise.resolve({ id, ...data }), // eslint-disable-line @typescript-eslint/no-explicit-any
  delete: (id: any) => Promise.resolve({ id }), // eslint-disable-line @typescript-eslint/no-explicit-any
};

export const nova = {
  entities: {
    ClothingItem: {
      list: mockApi.list,
      bulkCreate: mockApi.bulkCreate,
      delete: mockApi.delete,
    },
    PlannedOutfit: {
      list: mockApi.list,
      create: mockApi.create,
      update: mockApi.update,
      delete: mockApi.delete,
    },
  },
  integrations: {
    Core: {
      UploadFile: ({ _file }: { _file: any }) => Promise.resolve({ file_url: 'mock_file_url' }), // eslint-disable-line @typescript-eslint/no-explicit-any
      InvokeLLM: ({ _prompt, _file_urls, _response_json_schema }: { _prompt: string, _file_urls: string[], _response_json_schema: any }) => Promise.resolve({ items: [] }), // eslint-disable-line @typescript-eslint/no-explicit-any
    },
  },
};